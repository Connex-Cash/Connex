import "server-only";
import { PONS } from "@/config/brand";
import { CONTRACTS, EXTERNAL, OPERATOR, buybackLive, launchesLive, operatorKnown } from "@/config/contracts";
import { PAIRS } from "@/config/pairs";
import { address, readAddress, readWord, word } from "@/lib/abi";
import { ethCall, rpcBatch } from "@/lib/feeds/rpc";
import { SEL, decodeLaunches, decodeString, encode_, type ChainLaunch } from "@/lib/onchain/connex";
import type { DevHolds, Market } from "@/lib/agent/types";

/*
 * Server-side reads of the CONNEX contracts, Pons and the pair tokens.
 * Reads only: nothing here signs or sends a transaction. Results are cached
 * briefly in memory so a busy page does not turn into a burst of RPC calls.
 */

const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return value;
}

const GET_LAUNCHED = "0x3cf28b5a"; // getLaunchedToken(address)
const GET_RESERVES = "0x0902f1ac"; // getReserves()
const REAL_QUOTE = "0x4f1f58fd"; // realQuoteReserve()
const THRESHOLD = "0x8b0bc501"; // graduationThreshold()
const QUOTE_SINGLE = "0xaa9d21cb"; // v4 quoter quoteExactInputSingle
const SUPPLY_TOKENS = 1_000_000_000;
const ZERO = "0x0000000000000000000000000000000000000000";

/** Price, market cap and curve progress of an ETH-paired Pons launch, in ETH. Null for other pairs or unknown tokens. */
export function readMarket(token: string): Promise<Market | null> {
  return cached(`market:${token}`, 30_000, async () => {
    const record = await ethCall(PONS.factory, GET_LAUNCHED + address(token)).catch(() => null);
    if (!record || readWord(record, 14) !== 1n) return null;
    if (readAddress(record, 4) !== ZERO) return null; // priced in a pair token, not ETH
    const curve = readAddress(record, 1);
    const phase = Number(readWord(record, 10));
    if (phase === 0) {
      const [reserves, real, threshold] = await Promise.all([ethCall(curve, GET_RESERVES), ethCall(curve, REAL_QUOTE), ethCall(curve, THRESHOLD)]);
      const q = readWord(reserves, 0);
      const t = readWord(reserves, 1);
      const priceEth = t > 0n ? Number((q * 10n ** 18n) / t) / 1e18 : 0;
      const raised = readWord(real, 0);
      const goal = readWord(threshold, 0);
      return { phase, priceEth, mcapEth: priceEth * SUPPLY_TOKENS, progress: goal > 0n ? Math.min(100, Number((raised * 10_000n) / goal) / 100) : 0, raisedEth: Number(raised) / 1e18 };
    }
    if (phase === 2) {
      const poolKey = address(ZERO) + address(token) + word(readWord(record, 6)) + word(readWord(record, 7)) + address(PONS.memeHook);
      const amount = 1000n * 10n ** 18n;
      const params = poolKey + word(false) + word(amount) + word(32 * 8) + word(0);
      const out = await ethCall(PONS.v4Quoter, QUOTE_SINGLE + word(32) + params).catch(() => null);
      const priceEth = out ? Number((readWord(out, 0) * 10n ** 18n) / amount) / 1e18 : 0;
      return { phase, priceEth, mcapEth: priceEth * SUPPLY_TOKENS, progress: 100, raisedEth: Number(readWord(record, 11)) / 1e18 };
    }
    return { phase, priceEth: 0, mcapEth: 0, progress: 100, raisedEth: Number(readWord(record, 11)) / 1e18 };
  });
}

/** Every CONNEX launch, oldest first, straight from the launcher. */
export function readLaunches(): Promise<ChainLaunch[]> {
  if (!launchesLive()) return Promise.resolve([]);
  return cached("launches", 20_000, async () => {
    const count = Number(readWord(await ethCall(CONTRACTS.launcher, encode_.launchCount()), 0));
    const out: ChainLaunch[] = [];
    // Newest 400 at most; the site never lists more than that on one page.
    const start = Math.max(0, count - 400);
    for (let offset = start; offset < count; offset += 100) {
      const page = await ethCall(CONTRACTS.launcher, encode_.launchesPage(offset, 100));
      out.push(...decodeLaunches(page, offset));
    }
    return out;
  });
}

/** name() and symbol() of a token. */
export function readTokenMeta(token: string): Promise<{ name: string; symbol: string }> {
  return cached(`meta:${token}`, 3_600_000, async () => {
    const [n, s] = await Promise.all([ethCall(token, `0x${SEL.name}`).catch(() => "0x"), ethCall(token, `0x${SEL.symbol}`).catch(() => "0x")]);
    return { name: decodeString(n) || "Unnamed", symbol: decodeString(s) || "?" };
  });
}

/** What the launcher, the treasury and the operator wallet hold of a launched token (base units, as strings). */
export function readDevHolds(token: string): Promise<DevHolds | null> {
  if (!launchesLive()) return Promise.resolve(null);
  return cached(`holds:${token}`, 30_000, async () => {
    const calls = [CONTRACTS.launcher, CONTRACTS.treasury, ...(operatorKnown() ? [OPERATOR] : [])].map((who) => ({
      method: "eth_call",
      params: [{ to: token, data: encode_.balanceOf(who) }, "latest"],
    }));
    const res = await rpcBatch<string>(calls);
    const val = (i: number) => (res[i] ? readWord(res[i] as string, 0).toString() : "unknown");
    return { launcher: val(0), treasury: val(1), operator: operatorKnown() ? val(2) : null };
  });
}

export type TreasuryState = {
  buybackReserve: bigint;
  launchBudget: bigint;
  unsplit: bigint;
  pendingInEscrow: bigint;
  totalIn: bigint;
  launchFees: bigint;
  opsPaid: bigint;
  boughtBack: bigint;
  burned: bigint;
  rolledOver: bigint;
  lastBuybackAt: number;
  buyback: string | null;
  operatorBalance: bigint | null;
  readAt: number;
};

export function readTreasury(): Promise<TreasuryState | null> {
  if (!launchesLive()) return Promise.resolve(null);
  return cached("treasury", 20_000, async () => {
    const views = ["buybackReserve", "launchBudget", "unsplitEth", "totalEthIn", "totalLaunchFees", "totalOpsPaid", "totalBoughtBack", "totalBurned", "totalRolledOver", "lastBuybackAt", "buyback"] as const;
    const calls = [
      ...views.map((v) => ({ method: "eth_call", params: [{ to: CONTRACTS.treasury, data: encode_.view(v) }, "latest"] })),
      { method: "eth_call", params: [{ to: EXTERNAL.ponsFeeEscrow, data: encode_.balanceOf(CONTRACTS.treasury) }, "latest"] },
      ...(operatorKnown() ? [{ method: "eth_getBalance", params: [OPERATOR, "latest"] }] : []),
    ];
    const r = await rpcBatch<string>(calls);
    const w = (i: number) => (r[i] ? readWord(r[i] as string, 0) : 0n);
    const sink = r[10] ? readAddress(r[10] as string, 0) : ZERO;
    return {
      buybackReserve: w(0),
      launchBudget: w(1),
      unsplit: w(2),
      totalIn: w(3),
      launchFees: w(4),
      opsPaid: w(5),
      boughtBack: w(6),
      burned: w(7),
      rolledOver: w(8),
      lastBuybackAt: Number(w(9)) * 1000,
      buyback: sink === ZERO ? null : sink,
      pendingInEscrow: w(11),
      operatorBalance: operatorKnown() && r[12] ? BigInt(r[12] as string) : null,
      readAt: Date.now(),
    };
  });
}

export const buybackWired = () => buybackLive();

export type PairStatus = { symbol: string; name: string; address: string | null; kind: string; approved: boolean | null; verified: boolean | null };

/** Whether Pons accepts each pair right now, and whether each stock token is the official Robinhood one. */
export function readPairs(): Promise<PairStatus[]> {
  return cached("pairs", 10 * 60_000, async () => {
    const withAddr = PAIRS.filter((p) => p.address);
    const calls = withAddr.flatMap((p) => [
      { method: "eth_call", params: [{ to: PONS.factory, data: encode_.approvedPairTokens(p.address as string) }, "latest"] },
      { method: "eth_call", params: [{ to: p.address, data: `0x${SEL.name}` }, "latest"] },
    ]);
    const res = await rpcBatch<string>(calls).catch(() => calls.map(() => null));
    const map = new Map<string, { approved: boolean | null; verified: boolean | null }>();
    withAddr.forEach((p, i) => {
      const a = res[i * 2];
      const n = res[i * 2 + 1];
      const name = n ? decodeString(n as string) : null;
      map.set(p.symbol, {
        approved: a ? readWord(a as string, 0) === 1n : null,
        verified: p.kind === "stock" ? (name === null ? null : name.endsWith("• Robinhood Token")) : name === null ? null : true,
      });
    });
    return PAIRS.map((p) => ({ ...p, ...(p.address ? (map.get(p.symbol) ?? { approved: null, verified: null }) : { approved: true, verified: true }) }));
  });
}

const TOKEN_LAUNCHED = "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607"; // TokenLaunched(address,address,address,address,uint256,uint256)
const LOG_SPAN = 5_000;

export type PonsLaunch = { token: string; deployer: string; pairToken: string; block: number; tx: string; name: string; symbol: string; market: Market | null; at: number };

/** The newest launches on the Pons factory by anyone, read from its TokenLaunched events. */
export function readPonsLatest(limit = 10): Promise<PonsLaunch[]> {
  return cached(`pons:${limit}`, 60_000, async () => {
    const { rpc } = await import("@/lib/feeds/rpc");
    const head = Number(BigInt(await rpc<string>("eth_blockNumber", [])));
    const found: { token: string; deployer: string; pairToken: string; block: number; tx: string }[] = [];
    for (let n = 0, to = head; n < 12 && found.length < limit; n++, to -= LOG_SPAN) {
      const from = Math.max(0, to - LOG_SPAN + 1);
      const logs = await rpc<{ topics: string[]; data: string; blockNumber: string; transactionHash: string }[]>("eth_getLogs", [
        { address: PONS.factory, topics: [TOKEN_LAUNCHED], fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` },
      ]);
      for (const l of logs.reverse()) {
        found.push({
          token: `0x${l.topics[1].slice(-40)}`,
          deployer: `0x${l.topics[3].slice(-40)}`,
          pairToken: readAddress(l.data, 0),
          block: Number(BigInt(l.blockNumber)),
          tx: l.transactionHash,
        });
      }
    }
    const top = found.slice(0, limit);
    const headTime = Date.now();
    return Promise.all(
      top.map(async (f) => {
        const [meta, market] = await Promise.all([readTokenMeta(f.token), readMarket(f.token).catch(() => null)]);
        // About ten blocks a second on Robinhood Chain: close enough for an "x minutes old" label.
        return { ...f, ...meta, market, at: headTime - (head - f.block) * 100 };
      }),
    );
  });
}
