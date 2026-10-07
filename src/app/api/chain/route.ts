import { NextResponse } from "next/server";
import { chainStat } from "@/lib/chainstat";

export const dynamic = "force-dynamic";

/** Block, gas and ETH price for the status strip. Server-cached, no input. */
export async function GET() {
  const stat = await chainStat();
  return NextResponse.json(stat, { headers: { "cache-control": "public, max-age=5, s-maxage=10" } });
}
