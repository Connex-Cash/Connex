/*
 * Constructor arguments of the CONNEX contracts, ABI-encoded. Shared by the
 * owner's /deploy page and scripts/verify-deployment.mjs, so the bytes the
 * owner deploys and the bytes the check expects can never differ.
 */
import { EXTERNAL } from "../../config/contracts.ts";

const word = (v: bigint | number | string) => BigInt(v).toString(16).padStart(64, "0");
const addr = (a: string) => {
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) throw new Error(`Not an address: ${a}`);
  return a.slice(2).toLowerCase().padStart(64, "0");
};

export type TreasuryArgs = {
  operator: string;
  buybackShareBps: number;
  opsAllowanceWei: string;
  budgetCeilingWei: string;
  maxBuybackPerCallWei: string;
  minBuybackIntervalSec: number;
  fallbackAfterSec: number;
};
export type LauncherArgs = { treasury: string; operator: string; minIntervalSec: number };
export type BuybackArgs = { treasury: string; token: string };

export function treasuryArgs(a: TreasuryArgs) {
  if (a.buybackShareBps < 0 || a.buybackShareBps > 10_000) throw new Error("Buyback share must be 0 to 10,000 basis points.");
  if (BigInt(a.budgetCeilingWei) === 0n || BigInt(a.maxBuybackPerCallWei) === 0n) throw new Error("Ceiling and max buyback must be above zero.");
  if (a.fallbackAfterSec < a.minBuybackIntervalSec) throw new Error("The fallback wait must be at least the buyback interval.");
  return (
    addr(EXTERNAL.ponsFactory) +
    addr(EXTERNAL.ponsFeeEscrow) +
    addr(EXTERNAL.swapRouter02) +
    addr(EXTERNAL.weth) +
    addr(a.operator) +
    word(a.buybackShareBps) +
    word(a.opsAllowanceWei) +
    word(a.budgetCeilingWei) +
    word(a.maxBuybackPerCallWei) +
    word(a.minBuybackIntervalSec) +
    word(a.fallbackAfterSec)
  );
}

export const launcherArgs = (a: LauncherArgs) => addr(EXTERNAL.ponsFactory) + addr(a.treasury) + addr(a.operator) + word(a.minIntervalSec);
export const buybackArgs = (a: BuybackArgs) => addr(EXTERNAL.ponsFactory) + addr(EXTERNAL.poolManager) + addr(a.treasury) + addr(a.token);
