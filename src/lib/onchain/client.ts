"use client";

import { CHAIN } from "@/config/brand";
import { readWord } from "@/lib/abi";
import { revertReason, type Log } from "@/lib/onchain/connex";
import { rpc } from "@/lib/rpc";

/*
 * Browser side of the CONNEX contracts: reads through the site's RPC relay
 * (with the public endpoints as fallback), and a dry run of every transaction
 * before the wallet is asked to sign, so a revert is explained here in words
 * instead of failing on chain.
 */

export const call = (to: string, data: string, from?: string, value?: bigint) =>
  rpc<string>("eth_call", [{ to, data, ...(from ? { from } : {}), ...(value ? { value: `0x${value.toString(16)}` } : {}) }, "latest"]);

export const readUint = async (to: string, data: string) => readWord(await call(to, data), 0);

async function rawCall(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  return (await res.json()) as { result?: string; error?: { message?: string; data?: unknown } };
}

function revertData(error: { message?: string; data?: unknown } | undefined) {
  const d = error?.data;
  if (typeof d === "string" && d.startsWith("0x")) return d;
  if (d && typeof d === "object" && typeof (d as { data?: unknown }).data === "string") return (d as { data: string }).data;
  const m = error?.message?.match(/0x[0-9a-fA-F]{8,}/);
  return m ? m[0] : null;
}

/** eth_call as `from` with `value`; returns the result, or throws a readable reason when it would revert. */
export async function simulate(tx: { from: string; to?: string; data: string; value?: bigint }) {
  const params = [{ from: tx.from, ...(tx.to ? { to: tx.to } : {}), data: tx.data, ...(tx.value ? { value: `0x${tx.value.toString(16)}` } : {}) }, "latest"];
  let lastError: unknown;
  for (const url of ["/api/rpc", CHAIN.rpc, CHAIN.fallbackRpc]) {
    try {
      const body = await rawCall(url, { jsonrpc: "2.0", id: 1, method: "eth_call", params });
      if (!body.error) return body.result ?? "0x";
      const reason = revertReason(revertData(body.error));
      if (reason) throw new Error(reason);
      if (/insufficient funds/i.test(body.error.message ?? "")) throw new Error("Not enough ETH for this amount plus gas.");
      throw new Error(body.error.message?.replace(/^execution reverted:?\s*/i, "") || "The transaction would fail.");
    } catch (error) {
      if (error instanceof Error && !/^RPC \d+|fetch|network/i.test(error.message)) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not reach the chain.");
}

export type Receipt = { status: string; contractAddress: string | null; blockNumber: string; transactionHash: string; logs: Log[] };

export async function waitReceipt(hash: string, timeoutMs = 180_000): Promise<Receipt> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await rpc<Receipt | null>("eth_getTransactionReceipt", [hash]).catch(() => null);
    if (receipt) {
      if (receipt.status !== "0x1") throw new Error("The transaction reverted on chain.");
      return receipt;
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error("Still waiting for the block. Check the explorer for the result.");
}

export const txUrl = (hash: string) => `${CHAIN.explorer}/tx/${hash}`;
export const addressUrl = (a: string) => `${CHAIN.explorer}/address/${a}`;

export type Step = { to: string; data: string; value?: bigint; label: string };

/**
 * Runs steps in order: dry run, wallet, receipt. `onStage` reports progress
 * ("Approve CARTO: confirm in wallet…"); the last receipt is returned.
 */
export async function runSteps(
  steps: Step[],
  from: string,
  send: (tx: { to?: string; data: string; value?: bigint }) => Promise<string>,
  onStage: (text: string) => void,
): Promise<{ receipt: Receipt; hashes: string[] }> {
  let receipt: Receipt | null = null;
  const hashes: string[] = [];
  for (const step of steps) {
    onStage(`${step.label}: checking…`);
    await simulate({ from, to: step.to, data: step.data, value: step.value });
    onStage(`${step.label}: confirm in your wallet…`);
    const hash = await send({ to: step.to, data: step.data, value: step.value });
    hashes.push(hash);
    onStage(`${step.label}: waiting for the block…`);
    receipt = await waitReceipt(hash);
  }
  if (!receipt) throw new Error("Nothing to send.");
  return { receipt, hashes };
}
