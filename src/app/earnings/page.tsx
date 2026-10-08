import type { Metadata } from "next";
import { requestNow } from "@/lib/now";
import { JsonLd } from "@/components/JsonLd";
import { FeeCalendar } from "@/components/connex/FeeCalendar";
import { TreasuryPanel } from "@/components/connex/Treasury";
import { BandHead } from "@/components/ui";
import { BRAND } from "@/config/brand";
import { claims } from "@/lib/agent/data";
import { chainStat } from "@/lib/chainstat";
import { eth } from "@/lib/format";
import { readTreasury } from "@/lib/onchain/read";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const revalidate = 60;

export const metadata: Metadata = pageMeta({
  title: "Earnings",
  description: `The creator fees ${BRAND.name} collects from its launches, how the treasury splits them between the $CONNEX buyback and the next launches, day by day.`,
  path: "/earnings",
});

const DAY = 86_400_000;

export default async function EarningsPage() {
  const now = requestNow();
  const [c, treasury, stat] = await Promise.all([claims(now), readTreasury().catch(() => null), chainStat().catch(() => null)]);
  const ethUsd = stat?.ethUsd ?? null;
  const sum = (list: typeof c.claims) => list.reduce((a, x) => a + BigInt(x.ethWei), 0n);
  const all = sum(c.claims);
  const startToday = Math.floor(now / DAY) * DAY;
  const today = sum(c.claims.filter((x) => x.at >= startToday));
  const week = sum(c.claims.filter((x) => x.at >= now - 7 * DAY));
  const perDay = new Map<string, bigint>();
  for (const x of c.claims) {
    const k = new Date(x.at).toISOString().slice(0, 10);
    perDay.set(k, (perDay.get(k) ?? 0n) + BigInt(x.ethWei));
  }
  const best = [...perDay.entries()].sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))[0];
  const asUsd = (wei: bigint) => (ethUsd ? ` ≈ $${((Number(wei) / 1e18) * ethUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "");
  const firstAt = c.claims.length ? Math.min(...c.claims.map((x) => x.at)) : null;

  return (
    <main>
      <JsonLd data={breadcrumbs([{ name: "Earnings", path: "/earnings" }])} />
      <section className="band first">
        <div className="wrap">
          <BandHead kicker="Income" title="Earnings" h1>
            Creator fees the treasury collected, day by day. Each claim is split the moment it is booked. Tap a day to see its claims.
            {c.mode === "sample" ? " No contract is deployed yet, so these are illustrative figures." : ""}
          </BandHead>
          <div className="summary">
            <div className="sum hl">
              <div className="k">All time</div>
              <div className="v">{eth(all)} ETH</div>
              <div className="s">
                {c.claims.length} claims
                {firstAt ? ` since ${new Date(firstAt).toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` : ""}
              </div>
            </div>
            <div className="sum">
              <div className="k">Today</div>
              <div className="v">{eth(today)} ETH</div>
              <div className="s">so far{asUsd(today)}</div>
            </div>
            <div className="sum">
              <div className="k">Last 7 days</div>
              <div className="v">{eth(week)} ETH</div>
              <div className="s">≈ {eth(week / 7n)} ETH a day</div>
            </div>
            <div className="sum">
              <div className="k">Best day</div>
              <div className="v">{best ? `${eth(best[1])} ETH` : "–"}</div>
              <div className="s">
                {best
                  ? new Date(`${best[0]}T00:00:00Z`).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
                  : "none yet"}
              </div>
            </div>
          </div>
          <FeeCalendar claims={c.claims} now={now} sample={c.mode === "sample"} />
        </div>
      </section>
      <section className="band alt">
        <div className="wrap cols2">
          <TreasuryPanel state={treasury} ethUsd={ethUsd} />
          <div className="panel pad doc">
            <h3 style={{ fontSize: 20 }}>How a claim is booked</h3>
            <ol>
              <li>Pons holds each launch&apos;s creator fees in its fee escrow, credited to the treasury.</li>
              <li>
                Every five minutes the agent sweeps the curves and calls <code>collect()</code>. Anyone else may call it too; the money can only go to the
                treasury.
              </li>
              <li>
                The treasury splits whatever arrived: the {BRAND.symbol} buyback side first, the rest to the launch budget, any overflow back to buybacks.
              </li>
            </ol>
            <p className="faint" style={{ fontSize: 13.5 }}>
              To the buyback side so far: {eth(c.claims.reduce((a, x) => a + BigInt(x.toBuybackWei), 0n))} ETH. To the launch side:{" "}
              {eth(c.claims.reduce((a, x) => a + BigInt(x.toBudgetWei), 0n))} ETH.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
