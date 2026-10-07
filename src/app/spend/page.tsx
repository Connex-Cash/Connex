import type { Metadata } from "next";
import { requestNow } from "@/lib/now";
import { JsonLd } from "@/components/JsonLd";
import { MoneyTabs } from "@/components/connex/MoneyTabs";
import { SampleBanner } from "@/components/connex/Treasury";
import { BRAND } from "@/config/brand";
import { DEPLOY_DEFAULTS } from "@/config/contracts";
import { spend } from "@/lib/agent/data";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = pageMeta({
  title: "Spend",
  description: `What ${BRAND.name} spends to think: language model calls, X searches and logo drawings per day, the limits on each, and who pays.`,
  path: "/spend",
});

export default async function SpendPage() {
  const now = requestNow();
  const s = await spend(now);
  const tools = new Map<string, { kind: string; calls: number; usd: number }>();
  for (const day of s.days) for (const it of day.items) {
    const cur = tools.get(it.tool) ?? { kind: it.kind, calls: 0, usd: 0 };
    tools.set(it.tool, { kind: it.kind, calls: cur.calls + it.calls, usd: cur.usd + it.usd });
  }
  const totals = s.days.map((d) => ({ day: d.day, usd: d.items.reduce((a, i) => a + i.usd, 0) }));
  const week = totals.reduce((a, t) => a + t.usd, 0);
  const peak = Math.max(1, ...totals.map((t) => t.usd));
  const rounds = 48 * 7;
  return (
    <main className="wrap">
      <JsonLd data={breadcrumbs([{ name: "Spend", path: "/spend" }])} />
      <div className="page-h">
        <h1>Spend</h1>
        <p>Thinking costs money: every search, every model call and every logo is a paid request. This page counts them and shows the limits around them.</p>
        <MoneyTabs on="spend" />
      </div>
      <div className="grid grid-cols-1 gap-10 pt-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section aria-labelledby="days-h" className="grid content-start gap-5">
          {s.mode === "sample" ? <SampleBanner>The agent is not running yet, so these are illustrative costs for a week of rounds.</SampleBanner> : null}
          <h2 id="days-h" className="m-0 text-[26px]">
            Last seven days: ${week.toFixed(2)}
          </h2>
          <ul className="m-0 grid list-none gap-2 p-0" aria-label="Spend per day">
            {totals.map((t) => (
              <li key={t.day} className="grid grid-cols-[92px_minmax(0,1fr)_64px] items-center gap-3 text-[13px]">
                <span className="num text-ink-2">{t.day.slice(5)}</span>
                <span className="meter">
                  <i style={{ width: `${(t.usd / peak) * 100}%` }} />
                </span>
                <span className="num text-right">${t.usd.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="tbl-wrap">
            <table className="tbl min-w-[520px]">
              <thead>
                <tr>
                  <th>Model or tool</th>
                  <th className="r">Calls</th>
                  <th className="r">Cost</th>
                </tr>
              </thead>
              <tbody>
                {[...tools.entries()].map(([name, t]) => (
                  <tr key={name}>
                    <td>
                      {name} <span className="tag ml-1">{t.kind}</span>
                    </td>
                    <td className="num r">{t.calls.toLocaleString("en-US")}</td>
                    <td className="num r">${t.usd.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-[14px] text-ink-2">Average per round at this rate: ${(week / rounds).toFixed(3)}.</p>
        </section>
        <aside className="doc grid content-start !text-[15px]">
          <h2 className="!mt-0 !text-[24px]">The limits</h2>
          <ul>
            <li>Every model the agent may use must cost at most $1 per million input tokens and $4 per million output tokens. The price is checked when a model is configured and again before each run; if the catalogue cannot be read, the run does not happen.</li>
            <li>A site-wide ceiling on paid calls per hour, retries included, set by the operator.</li>
            <li>A spending cap per round: a round that hits it stops where it is.</li>
            <li>A cooldown per step after a failure, so a broken API is not hammered.</li>
          </ul>
          <h3>Who pays</h3>
          <p>
            The tools are paid by the operator&apos;s API accounts, off chain. The treasury reimburses a fixed {Number(DEPLOY_DEFAULTS.opsAllowanceWei) / 1e18} ETH per
            launch from the launch side, and only when that side can cover it. The buyback side never pays for thinking.
          </p>
        </aside>
      </div>
    </main>
  );
}
