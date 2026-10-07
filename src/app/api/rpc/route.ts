import { NextResponse } from "next/server";
import { RpcError, rpc, rpcBatch } from "@/lib/feeds/rpc";
import { allowNetwork, readBody, tooMany, trustProxyHeaders } from "@/lib/guard";
import { spend } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

/*
 * Read-only JSON-RPC relay. Some networks intercept the chain's public RPC
 * host, so the browser can read through this server instead. Only read
 * methods pass; transactions always go through the visitor's own wallet.
 *
 * Every request is charged against a per-network budget (IPv4 address or
 * IPv6 /64) weighted by what it costs the node, with or without a store.
 * Self-hosted (no trusted edge), a site-wide ceiling applies as well.
 */

const ALLOWED = new Set([
  "eth_call",
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBalance",
  "eth_getBlockByNumber",
  "eth_gasPrice",
  "eth_getTransactionReceipt",
  "eth_getLogs",
]);
const MAX_CALLS = 20;
const MAX_LOGS_PER_BATCH = 3;
const MAX_LOG_SPAN = 5_000;
const MAX_BODY = 32 * 1024;
const BUDGET = 1500; // units per window per network (an open coin page uses ~450)
const SITE_BUDGET = 12_000; // units per window for the whole site, self-hosted only
const WINDOW_SEC = 600;
const COST: Record<string, number> = { eth_getLogs: 10, eth_call: 2 };

const hexBlock = (v: unknown) => (typeof v === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(v) ? Number(BigInt(v)) : null);
const isAddr = (v: unknown) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const isTag = (v: unknown) => v === undefined || v === "latest" || v === "pending" || hexBlock(v) !== null;

type Call = { jsonrpc?: string; id?: number | string; method?: unknown; params?: unknown };
type Clean = { id: number | string | undefined; method: string; params: unknown[] };

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

/** Validates one call and returns what will actually be forwarded. */
function check(c: Call): Clean | string {
  if (typeof c.method !== "string" || !ALLOWED.has(c.method)) return `Method not allowed: ${String(c.method)}`;
  if (c.params !== undefined && !Array.isArray(c.params)) return "params must be an array.";
  const params = (c.params as unknown[] | undefined) ?? [];
  if (c.method === "eth_call") {
    // No state overrides (a third parameter) and no caller-chosen gas.
    if (params.length < 1 || params.length > 2) return "eth_call takes a call object and a block tag.";
    const call = params[0] as Record<string, unknown> | null;
    if (!call || typeof call !== "object" || !isAddr(call.to)) return "eth_call needs a contract address in `to`.";
    if (call.data !== undefined && (typeof call.data !== "string" || !/^0x[0-9a-fA-F]*$/.test(call.data) || call.data.length > 8192)) {
      return "eth_call data must be hex.";
    }
    if (call.from !== undefined && !isAddr(call.from)) return "eth_call from must be an address.";
    if (call.value !== undefined && hexBlock(call.value) === null && !(typeof call.value === "string" && /^0x[0-9a-fA-F]{1,64}$/.test(call.value))) {
      return "eth_call value must be hex.";
    }
    if (!isTag(params[1])) return "Unsupported block tag.";
    const forwarded: Record<string, unknown> = { to: call.to };
    if (call.data !== undefined) forwarded.data = call.data;
    if (call.from !== undefined) forwarded.from = call.from;
    if (call.value !== undefined) forwarded.value = call.value;
    return { id: c.id, method: c.method, params: [forwarded, params[1] ?? "latest"] };
  }
  if (c.method === "eth_getLogs") {
    const filter = (params[0] ?? {}) as { fromBlock?: unknown; toBlock?: unknown; blockHash?: unknown; address?: unknown; topics?: unknown };
    if (params.length !== 1) return "eth_getLogs takes one filter.";
    if (filter.blockHash !== undefined) return "eth_getLogs by blockHash is not relayed.";
    // Both ends must be hex numbers: "latest" or a missing toBlock would let
    // one request scan the whole chain on the operator's RPC.
    const from = hexBlock(filter.fromBlock);
    const to = hexBlock(filter.toBlock);
    if (from === null || to === null) return "eth_getLogs needs numeric fromBlock and toBlock.";
    if (to < from || to - from > MAX_LOG_SPAN) return "Log range too wide.";
    return { id: c.id, method: c.method, params: [{ fromBlock: filter.fromBlock, toBlock: filter.toBlock, address: filter.address, topics: filter.topics }] };
  }
  if (params.length > 2) return "Too many params.";
  return { id: c.id, method: c.method, params };
}

function logSpan(c: Clean) {
  if (c.method !== "eth_getLogs") return 0;
  const f = c.params[0] as { fromBlock: string; toBlock: string };
  return (hexBlock(f.toBlock) ?? 0) - (hexBlock(f.fromBlock) ?? 0);
}

export async function POST(request: Request) {
  const body = await readBody<Call | Call[]>(request, MAX_BODY);
  if ("response" in body) return body.response;
  const raw = Array.isArray(body.data) ? body.data : [body.data];
  if (raw.length === 0 || raw.length > MAX_CALLS) return bad("Too many calls.");
  const calls: Clean[] = [];
  for (const c of raw) {
    const clean = check(c ?? {});
    if (typeof clean === "string") return bad(clean);
    calls.push(clean);
  }
  const logs = calls.filter((c) => c.method === "eth_getLogs");
  if (logs.length > MAX_LOGS_PER_BATCH) return bad("Too many log queries in one request.");
  if (logs.reduce((sum, c) => sum + logSpan(c), 0) > MAX_LOG_SPAN) return bad("Log ranges too wide in total.");

  const cost = calls.reduce((sum, c) => sum + (COST[c.method] ?? 1), 0);
  if (!(await allowNetwork(request, "rpc", BUDGET, WINDOW_SEC, cost))) return tooMany();
  if (!trustProxyHeaders() && !(await spend("rpc:site", cost, SITE_BUDGET, WINDOW_SEC))) return tooMany();

  if (!Array.isArray(body.data)) {
    // A single call keeps the node's own error, so a revert reads as a revert.
    const c = calls[0];
    try {
      const result = await rpc(c.method, c.params);
      return NextResponse.json({ jsonrpc: "2.0", id: c.id ?? 1, result }, { headers: { "cache-control": "no-store" } });
    } catch (error) {
      if (error instanceof RpcError && error.revert) {
        return NextResponse.json({ jsonrpc: "2.0", id: c.id ?? 1, error: { code: 3, message: error.message } });
      }
      return NextResponse.json({ error: "The chain could not be reached." }, { status: 502 });
    }
  }
  try {
    const results = await rpcBatch(calls.map((c) => ({ method: c.method, params: c.params })));
    const out = calls.map((c, i) => ({ jsonrpc: "2.0", id: c.id ?? i, result: results[i] ?? null }));
    return NextResponse.json(out, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The chain could not be reached." }, { status: 502 });
  }
}
