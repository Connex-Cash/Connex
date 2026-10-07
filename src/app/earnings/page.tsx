import type { Metadata } from "next";
import { requestNow } from "@/lib/now";
import { JsonLd } from "@/components/JsonLd";
import { MoneyTabs } from "@/components/connex/MoneyTabs";
import { FeeSplit, SampleBanner, TreasuryPanel } from "@/components/connex/Treasury";
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

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function EarningsPage() {
  const now = requestNow();
  const [c, treasury, stat] = await Promise.all([claims(now), readTreasury().catch(() => null), chainStat().catch(() => null)]);
  const d = new Date(now);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
  const perDay = new Map<number, { wei: bigint; n: number }>();
  for (const cl of c.claims) {
    const cd = new Date(cl.at);
    if (cd.getUTCFullYear() !== y || cd.getUTCMonth() !== m) continue;
    const k = cd.getUTCDate();
    const cur = perDay.get(k) ?? { wei: 0n, n: 0 };
    perDay.set(k, { wei: cur.wei + BigInt(cl.ethWei), n: cur.n + 1 });
  }
  const monthTotal = [...perDay.values()].reduce((a, v) => a + v.wei, 0n);
  const best = [...perDay.entries()].sort((a, b) => (b[1].wei > a[1].wei ? 1 : -1))[0];
  const max = best ? best[1].wei : 1n;
  const monthName = d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <main className="wrap">
      <JsonLd data={breadcrumbs([{ name: "Earnings", path: "/earnings" }])} />
      <div className="page-h">
        <h1>Earnings</h1>
        <p>Creator fees are the agent&apos;s only income. Each claim lands in the treasury contract and is split the moment it is booked.</p>
        <MoneyTabs on="earnings" />
      </div>
      <div className="grid grid-cols-1 gap-10 pt-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section aria-labelledby="cal-h" className="grid content-start gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="cal-h" className="m-0 text-[26px]">
              {monthName}
            </h2>
            <span className="num text-[14px]">{eth(monthTotal)} ETH this month</span>
          </div>
          {c.mode === "sample" ? (
            <SampleBanner>Illustrative claims: no contract is deployed, so no fee has been earned yet. The calendar fills from the treasury once it is live.</SampleBanner>
          ) : c.claims.length === 0 ? (
            <p className="note m-0">No claims recorded yet. The treasury totals on the right are read from the chain directly.</p>
          ) : null}
          <div className="grid grid-cols-7 gap-1" role="table" aria-label={`Fees per day, ${monthName}`}>
            {WEEK.map((w) => (
              <span key={w} role="columnheader" className="pb-1 text-center font-mono text-[11px] text-ink-4 uppercase">
                {w}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`e${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1;
              const v = perDay.get(day);
              const future = Date.UTC(y, m, day) > now;
              const level = v ? Math.max(0.12, Number((v.wei * 100n) / max) / 100) : 0;
              return (
                <div
                  key={day}
                  role="cell"
                  className={`grid min-h-[64px] min-w-0 content-between rounded-[3px] border p-1.5 ${future ? "border-dashed border-line text-ink-4" : "border-line"}`}
                  style={v ? { background: `color-mix(in srgb, var(--signal) ${Math.round(level * 55)}%, var(--surface))` } : undefined}
                >
                  <span className="font-mono text-[11px]">{day}</span>
                  {v ? <span className="num truncate text-[11px] font-semibold">{eth(v.wei, 3)}</span> : null}
                </div>
              );
            })}
          </div>
          <dl className="rows">
            <div>
              <dt>Claims this month</dt>
              <dd>{[...perDay.values()].reduce((a, v) => a + v.n, 0)}</dd>
            </div>
            <div>
              <dt>Best day</dt>
              <dd>{best ? `${monthName.split(" ")[0]} ${best[0]}: ${eth(best[1].wei)} ETH` : "–"}</dd>
            </div>
            <div>
              <dt>To the buyback side</dt>
              <dd>{eth(c.claims.reduce((a, cl) => a + BigInt(cl.toBuybackWei), 0n))} ETH</dd>
            </div>
            <div>
              <dt>To the launch side</dt>
              <dd>{eth(c.claims.reduce((a, cl) => a + BigInt(cl.toBudgetWei), 0n))} ETH</dd>
            </div>
          </dl>
        </section>
        <aside className="grid content-start gap-6">
          <TreasuryPanel state={treasury} ethUsd={stat?.ethUsd ?? null} />
          <FeeSplit />
          <div className="doc !text-[15px]">
            <h3 className="!mt-0">How a claim is booked</h3>
            <ol>
              <li>Pons holds each launch&apos;s creator fees in its fee escrow, credited to the treasury.</li>
              <li>Every five minutes the agent sweeps the curves and calls <code>collect()</code>. Anyone else may call it too; the money can only go to the treasury.</li>
              <li>The treasury splits whatever arrived: {BRAND.symbol} buyback side first, the rest to the launch budget, the overflow back to buybacks.</li>
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
}
