import type { Metadata } from "next";
import { requestNow } from "@/lib/now";
import { JsonLd } from "@/components/JsonLd";
import { BandHead } from "@/components/ui";
import { BRAND } from "@/config/brand";
import { DEPLOY_DEFAULTS } from "@/config/contracts";
import { spend } from "@/lib/agent/data";
import { chainStat } from "@/lib/chainstat";
import { readTreasury } from "@/lib/onchain/read";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const revalidate = 300;

export const metadata: Metadata = pageMeta({
  title: "Spend",
  description: `What ${BRAND.name} spends to think: language model calls, X searches and logo drawings per day, the limits on each, and who pays.`,
  path: "/spend",
});

const money = (v: number) => `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`;

export default async function SpendPage() {
  const now = requestNow();
  const [s, treasury, stat] = await Promise.all([spend(now), readTreasury().catch(() => null), chainStat().catch(() => null)]);
  const tools = new Map<string, { kind: string; calls: number; usd: number }>();
  for (const day of s.days)
    for (const it of day.items) {
      const cur = tools.get(it.tool) ?? { kind: it.kind, calls: 0, usd: 0 };
      tools.set(it.tool, { kind: it.kind, calls: cur.calls + it.calls, usd: cur.usd + it.usd });
    }
  const ranked = [...tools.entries()].sort((a, b) => b[1].usd - a[1].usd);
  const top = Math.max(0.01, ...ranked.map(([, t]) => t.usd));
  const totals = s.days.map((d) => ({ day: d.day, usd: d.items.reduce((a, i) => a + i.usd, 0) }));
  const week = totals.reduce((a, t) => a + t.usd, 0);
  const peak = Math.max(1, ...totals.map((t) => t.usd));
  const rounds = 48 * Math.max(1, totals.length);
  const reimbursed = treasury && stat?.ethUsd ? (Number(treasury.opsPaid) / 1e18) * stat.ethUsd : 0;
  const points = totals.map((t, i) => [totals.length > 1 ? (i / (totals.length - 1)) * 600 : 300, 190 - (t.usd / peak) * 175] as const);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const last = points[points.length - 1];

  return (
    <main>
      <JsonLd data={breadcrumbs([{ name: "Spend", path: "/spend" }])} />
      <section className="band first">
        <div className="wrap">
          <BandHead kicker="Running costs" title="Does It Cover Its Own Costs?" h1>
            Every search, model call and logo is a paid request. This page sets what the agent spends on thinking against what the treasury pays back from fees:
            a fixed {Number(DEPLOY_DEFAULTS.opsAllowanceWei) / 1e18} ETH per launch.
          </BandHead>
          <div className="selffund">
            <span className="sf-ic" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="22" height="22" shapeRendering="crispEdges">
                <path fill="currentColor" d="M2 3h12v2H2zM2 7h8v2H2zM2 11h5v2H2zM11 9h3v5h-3zM12 7h1v2h-1z" />
              </svg>
            </span>
            <div>
              <b>Paid by the operator for now.</b> {s.mode === "sample" ? "The agent is not running yet, so the costs below are an illustrative week. " : ""}
              The API accounts behind the agent are paid off chain. Once launches earn fees, the launch side of the treasury pays back a fixed amount per
              launch, and only when it can cover it. The buyback side never pays for thinking.
            </div>
          </div>
          <div className="stats">
            <div className="stat">
              <span className="lbl">Paid back from fees</span>
              <span className="v">{money(reimbursed)}</span>
              <span className="note">Launch side, all time</span>
            </div>
            <div className="stat">
              <span className="lbl">Spent on tools</span>
              <span className="v">{money(week)}</span>
              <span className="note">Models and searches, last {totals.length} days</span>
            </div>
            <div className="stat">
              <span className="lbl">Cost per round</span>
              <span className="v">${(week / rounds).toFixed(3)}</span>
              <span className="note">Reading to review</span>
            </div>
            <div className="stat">
              <span className="lbl">Net</span>
              <span className="v" style={{ color: reimbursed - week < 0 ? "var(--red)" : "var(--green)" }}>
                {money(reimbursed - week)}
              </span>
              <span className="note">Paid back minus spent</span>
            </div>
          </div>
        </div>
      </section>
      <section className="band alt">
        <div className="wrap cols2">
          <div className="panel pad chart">
            <h3>Daily spend</h3>
            <div className="faint mono" style={{ fontSize: 13 }}>
              {money(totals[totals.length - 1]?.usd ?? 0)} today{s.mode === "sample" ? " · sample" : ""}
            </div>
            <svg viewBox="0 0 600 200" preserveAspectRatio="none" aria-label="Dollars spent per day">
              {[50, 100, 150].map((y) => (
                <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="rgba(140,165,255,.13)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              ))}
              <defs>
                <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#c6f24e" stopOpacity=".22" />
                  <stop offset="1" stopColor="#c6f24e" stopOpacity="0" />
                </linearGradient>
              </defs>
              {points.length ? (
                <>
                  <path d={`${line}L600,200L0,200Z`} fill="url(#spend-fill)" />
                  <path d={line} fill="none" stroke="#c6f24e" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <circle cx={last[0]} cy={last[1]} r="4" fill="#c6f24e" />
                </>
              ) : null}
            </svg>
            <div className="axis">
              <span>{totals[0]?.day ?? ""}</span>
              <span>{totals[totals.length - 1]?.day ?? ""}</span>
            </div>
          </div>
          <div className="panel pad">
            <h3 style={{ marginBottom: 6 }}>Models and tools</h3>
            {ranked.map(([name, t]) => (
              <div className="hb" key={name}>
                <div className="hb-top">
                  <span>
                    {name}{" "}
                    <span className="faint mono" style={{ fontSize: 11 }}>
                      {t.kind} · {t.calls.toLocaleString("en-US")} calls
                    </span>
                  </span>
                  <span className="num">{money(t.usd)}</span>
                </div>
                <span className="meter">
                  <i style={{ width: `${(t.usd / top) * 100}%` }} />
                </span>
              </div>
            ))}
            <h3 style={{ margin: "18px 0 6px", fontSize: 16 }}>The limits</h3>
            <ul className="blog" style={{ maxHeight: "none" }}>
              <li>
                <time>price</time>
                <span>Every model must cost at most $1 per million input tokens and $4 per million output tokens, checked at setup and before each run.</span>
              </li>
              <li>
                <time>hourly</time>
                <span>A ceiling on paid calls per hour, retries included, set by the operator.</span>
              </li>
              <li>
                <time>round</time>
                <span>A spending cap per round: a round that reaches it stops where it is.</span>
              </li>
              <li>
                <time>retry</time>
                <span>A cooldown per step after a failure, so a broken API is not hammered.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
