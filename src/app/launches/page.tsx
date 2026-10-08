import type { Metadata } from "next";
import Link from "next/link";
import { requestNow } from "@/lib/now";
import { JsonLd } from "@/components/JsonLd";
import { LaunchExplorer, LaunchTable } from "@/components/connex/LaunchList";
import { pairKind } from "@/components/connex/launchView";
import { BandHead } from "@/components/ui";
import { BRAND } from "@/config/brand";
import { launchFeed } from "@/lib/agent/data";
import type { Launch } from "@/lib/agent/types";
import { chainStat } from "@/lib/chainstat";
import { ago, hhmm, usd } from "@/lib/format";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "All launches",
  description: `Every token ${BRAND.name} has launched on Pons: name, pair, launch time, market cap and what the dev side holds of it, read from the chain.`,
  path: "/launches",
});

type Lane = {
  kicker: string;
  color: string;
  title: string;
  lede: string;
  how: [string, string][];
  pick: (l: Launch) => boolean;
};

const LANES: Record<string, Lane> = {
  eth: {
    kicker: "Quoted in ETH",
    color: "#9cc0ff",
    title: "ETH Pairs",
    lede: "Most topics have no company in them, so the token trades against ETH. These are the launches quoted in ETH; once the launcher is live, their market caps come straight from Pons.",
    how: [
      ["1. Nobody's brand in it", "A pigeon, a weather map, a sandwich: when no listed company is part of the joke, ETH is the pair."],
      ["2. One quote asset, for good", "Pons fixes the pair at launch. The curve, the pool and the price all run in ETH from then on."],
      ["3. Fees arrive in ETH", "The creator slice lands in the treasury as ETH and is split the moment it is collected."],
    ],
    pick: (l) => pairKind(l.pair.symbol) === "eth",
  },
  stock: {
    kicker: "Quoted in a stock token",
    color: "#ffb85c",
    title: "Stock Pairs",
    lede: "When a company is the punchline, the token can trade against that company's Robinhood stock token instead of ETH. Pons keeps the list of accepted stock pairs on chain.",
    how: [
      ["1. The company is the joke", "A gag about graphics chips can pair with NVDA. A passing mention of a brand is not enough."],
      ["2. Matched by address", "Stock tokens are recognised by contract, never by ticker, because lookalike tickers are everywhere on the chain."],
      ["3. Fees arrive in the stock", "The treasury splits them the same way, and the agent swaps each half to ETH on its own side."],
    ],
    pick: (l) => pairKind(l.pair.symbol) === "stock",
  },
  breaking: {
    kicker: "Between rounds",
    color: "#ff8080",
    title: "Breaking",
    lede: "When a post takes off between rounds, the agent runs the same nine steps at once instead of waiting for :00 or :30. Same trader check, same naming rules, same limits on spending and launches.",
    how: [
      ["1. A sudden spike", "A post whose engagement climbs far faster than the rest of the feed, minutes after it went up."],
      ["2. The full check, no shortcut", "The skeptical trader still has to rate it 8/10. A weak spike is logged and dropped."],
      ["3. The same launcher", "It goes out through the same contract, so the 10-minute gap between launches still applies."],
    ],
    pick: (l) => l.lane === "breaking",
  },
};

export default async function LaunchesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show = "all" } = await searchParams;
  const now = requestNow();
  const [feed, stat] = await Promise.all([launchFeed(now), chainStat().catch(() => null)]);
  const ethUsd = stat?.ethUsd ?? null;
  const sample = feed.mode === "sample";
  const lane = LANES[show];

  if (lane) {
    const list = feed.launches.filter(lane.pick);
    const fees = list.reduce((a, l) => a + (l.sampleFeesEth ?? 0), 0);
    const mcap = list.reduce((a, l) => a + (l.market && ethUsd ? l.market.mcapEth * ethUsd : 0), 0);
    return (
      <main>
        <JsonLd data={breadcrumbs([{ name: "All launches", path: "/launches" }])} />
        <section className="band first">
          <div className="wrap">
            <BandHead
              kicker={lane.kicker}
              kickerColor={lane.color}
              title={lane.title}
              h1
              aside={<span className="chip">{sample ? "sample data" : `${list.length} on chain`}</span>}
            >
              {lane.lede}
            </BandHead>
            <div className="summary">
              <div className="sum hl">
                <div className="k">Launches</div>
                <div className="v">{list.length}</div>
                <div className="s">of {feed.launches.length} in total</div>
              </div>
              <div className="sum">
                <div className="k">Newest</div>
                <div className="v">{list[0] ? list[0].name : "–"}</div>
                <div className="s">{list[0] ? `${ago(list[0].launchedAt, now)} ago` : "none yet"}</div>
              </div>
              <div className="sum">
                <div className="k">{sample ? "Sample fees" : "Market cap"}</div>
                <div className="v">{sample ? `≈${fees.toFixed(3)} ETH` : usd(mcap)}</div>
                <div className="s">{sample ? "illustrative only" : "summed, ETH pairs"}</div>
              </div>
              <div className="sum">
                <div className="k">Share</div>
                <div className="v">{feed.launches.length ? `${Math.round((list.length / feed.launches.length) * 100)}%` : "–"}</div>
                <div className="s">of every launch</div>
              </div>
            </div>
            <div className="how3">
              {lane.how.map(([t, p]) => (
                <div key={t}>
                  <b>{t}</b>
                  <p>{p}</p>
                </div>
              ))}
            </div>
            <h3 className="h3gap">Latest {lane.title.toLowerCase()}</h3>
            <LaunchTable launches={list} ethUsd={ethUsd} now={now} empty={`No ${lane.title.toLowerCase()} launches yet.`} />
            <div className="panel pad" style={{ marginTop: 24 }}>
              <h3 style={{ marginBottom: 8 }}>Log</h3>
              <ul className="blog">
                {list.slice(0, 20).map((l) => (
                  <li key={l.id}>
                    <time>{hhmm(l.launchedAt)}</time>
                    <span>
                      Launched{" "}
                      <Link className="tlink" href={`/launches/${l.id}`}>
                        {l.name}
                      </Link>{" "}
                      (${l.symbol}) against {l.pair.symbol}
                      {l.scores ? `, trader score ${l.scores.appeal}/10` : ""}
                      {l.mode === "sample" ? " · sample" : ""}
                    </span>
                  </li>
                ))}
                {!list.length ? <li className="empty">Nothing logged in this lane yet.</li> : null}
              </ul>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <JsonLd data={breadcrumbs([{ name: "All launches", path: "/launches" }])} />
      <section className="band first">
        <div className="wrap">
          <BandHead
            kicker="History"
            title="All Launches"
            h1
            aside={
              <Link className="btn ghost-lime" href="/round">
                Watch the live round
              </Link>
            }
          >
            Every token the agent has put on Pons, newest first. A row appears only once the launcher contract has a record of it, so a launch that never
            happened cannot be listed. Click any row to see how it was made.
            {sample ? " The launcher is not deployed yet: these rows are samples with no address." : ` ${feed.error ?? ""}`}
          </BandHead>
          <LaunchExplorer launches={feed.launches} ethUsd={ethUsd} now={now} />
          <p className="faint" style={{ fontSize: 13.5, marginTop: 18 }}>
            Dev holds adds up what the launcher contract, the treasury and the agent&apos;s wallet hold of each token, read live. Market cap is shown for ETH
            pairs; stock pairs are priced in their stock.
          </p>
        </div>
      </section>
    </main>
  );
}
