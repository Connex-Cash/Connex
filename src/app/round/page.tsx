import type { Metadata } from "next";
import { requestNow } from "@/lib/now";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { LiveRound } from "@/components/connex/RoundView";
import { SampleBanner } from "@/components/connex/Treasury";
import { BRAND } from "@/config/brand";
import { currentRound, recentRounds } from "@/lib/agent/data";
import { utc } from "@/lib/format";
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
    <main className="wrap">
      <JsonLd data={breadcrumbs([{ name: "Current round", path: "/round" }])} />
      <div className="page-h">
        <h1>Current round</h1>
        <p>
          A new round opens at :00 and :30 UTC. This page follows it one step at a time, in ordinary language, including the topics the agent turned down and why.
        </p>
      </div>
      <div className="grid gap-8 pt-8">
        {round.mode === "sample" ? (
          <SampleBanner>
            The agent is not running yet. This is a sample round that moves with the real clock so you can see how one reads; its topics and token are
            invented and nothing is launched.
          </SampleBanner>
        ) : null}
        <LiveRound initial={round} />
        <section aria-labelledby="past-h" className="grid gap-4">
          <h2 id="past-h" className="m-0 text-[24px]">
            Earlier rounds
          </h2>
          <ul className="m-0 grid list-none border-t-2 border-ink p-0">
            {past.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line py-3">
                <span className="num text-[13px] text-ink-2">{utc(r.startsAt)}</span>
                <span className="min-w-0 flex-1">
                  {r.token ? (
                    <>
                      <b>{r.token.name}</b> <span className="num text-[13px] text-ink-2">${r.token.symbol} · {r.token.pair}</span>
                    </>
                  ) : (
                    <span className="text-ink-2">No launch: nothing reached 8/10 with the trader check.</span>
                  )}
                </span>
                <span className="tag">{r.mode === "sample" ? "sample" : r.outcome}</span>
              </li>
            ))}
          </ul>
          <Link href="/launches" className="tlink text-[14px]">
            Every launch
          </Link>
        </section>
      </div>
    </main>
  );
}
