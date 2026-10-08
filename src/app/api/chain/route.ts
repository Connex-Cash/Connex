import { NextResponse } from "next/server";
import { launchesLive } from "@/config/contracts";
import { chainStat } from "@/lib/chainstat";
import { readTreasury } from "@/lib/onchain/read";

export const dynamic = "force-dynamic";

/** Block, gas, ETH price and the treasury's ETH, for the header. Server-cached, no input. */
export async function GET() {
  const [stat, t] = await Promise.all([chainStat(), readTreasury().catch(() => null)]);
  const treasuryWei = t ? (t.buybackReserve + t.launchBudget + t.unsplit + t.pendingInEscrow).toString() : null;
  return NextResponse.json(
    { ...stat, treasury: { deployed: launchesLive(), wei: treasuryWei } },
    { headers: { "cache-control": "public, max-age=5, s-maxage=10" } },
  );
}
