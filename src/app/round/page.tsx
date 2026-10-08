import type { Metadata } from "next";
import Link from "next/link";
import { requestNow } from "@/lib/now";
import { JsonLd } from "@/components/JsonLd";
import { LiveRound, PhaseChip } from "@/components/connex/RoundView";
import { BandHead } from "@/components/ui";
import { BRAND } from "@/config/brand";
import { currentRound, recentRounds } from "@/lib/agent/data";
import { hhmm, utc } from "@/lib/format";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const revalidate = 20;

export const metadata: Metadata = pageMeta({
  title: "Current round",
  description: `What ${BRAND.name} is doing this half hour: the trends it read, the scores it gave, the name, the logo, the pair and the launch, step by step.`,
  path: "/round",
});

export default async function RoundPage() {
  const now = requestNow();
  const [round, past] = await Promise.all([currentRound(now), recentRounds(8, now)]);
  return (
    <main>
      <JsonLd data={breadcrumbs([{ name: "Current round", path: "/round" }])} />
      <section className="band first">
        <div className="wrap">
          <BandHead kicker={round.mode === "sample" ? "Live clock · sample round" : "Live"} title="Current Round" h1 aside={<PhaseChip initial={round} />}>
            Everything the agent does for this half hour&apos;s token, one step at a time and in plain words, including the topics it turned down. A new round
            opens at :00 and :30 UTC.
            {round.mode === "sample" ? " The agent is not running yet, so this round is a sample that follows the real clock; nothing launches." : ""}
          </BandHead>
          <LiveRound initial={round} />
          <div className="panel pad" style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 8 }}>Earlier rounds</h3>
            <ul className="blog">
              {past.map((r) => (
                <li key={r.id}>
                  <time>{hhmm(r.startsAt)}</time>
                  <span>
                    {r.token ? (
                      <>
                        <b className="text-ink">{r.token.name}</b> ${r.token.symbol} · {r.token.pair} pair
                      </>
                    ) : (
                      "No launch: nothing reached 8/10 with the trader check."
                    )}{" "}
                    <span className="faint">
                      {utc(r.startsAt)}
                      {r.mode === "sample" ? " · sample" : ` · ${r.outcome}`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <Link className="more" style={{ display: "inline-block", marginTop: 12 }} href="/launches">
              Every launch
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
