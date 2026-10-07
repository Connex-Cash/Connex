import "server-only";
import { ticker } from "@/lib/feeds/okx";
import { rpcBatch } from "@/lib/feeds/rpc";

export type ChainStat = { block: number | null; gasGwei: number | null; ethUsd: number | null; at: number };

let last: ChainStat | null = null;
let job: Promise<ChainStat> | null = null;

/** Latest block, gas price and ETH/USD, read live and cached for ten seconds. */
export function chainStat(): Promise<ChainStat> {
  if (last && Date.now() - last.at < 10_000) return Promise.resolve(last);
  if (!job) {
    job = (async () => {
      const [r, t] = await Promise.all([
        rpcBatch<string>([
          { method: "eth_blockNumber", params: [] },
          { method: "eth_gasPrice", params: [] },
        ]).catch(() => [null, null]),
        ticker("ETH-USDT").catch(() => null),
      ]);
      const value: ChainStat = {
        block: r[0] ? Number(BigInt(r[0])) : (last?.block ?? null),
        gasGwei: r[1] ? Number(BigInt(r[1])) / 1e9 : (last?.gasGwei ?? null),
        ethUsd: t?.last ?? last?.ethUsd ?? null,
        at: Date.now(),
      };
      last = value;
      return value;
    })().finally(() => {
      job = null;
    });
  }
  return last ? Promise.resolve(last) : job;
}
