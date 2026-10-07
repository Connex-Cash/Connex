import { NextResponse } from "next/server";
import { currentRound } from "@/lib/agent/data";

export const dynamic = "force-dynamic";

/** The round running now, for the live view to refresh. Sample rounds say so in `mode`. */
export async function GET() {
  const round = await currentRound();
  return NextResponse.json(round, { headers: { "cache-control": "public, max-age=10, s-maxage=15" } });
}
