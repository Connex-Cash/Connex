import type { Metadata } from "next";
import { requestNow } from "@/lib/now";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { LaunchTable } from "@/components/connex/LaunchTable";
import { SampleBanner } from "@/components/connex/Treasury";
import { ChainTag } from "@/components/ui";
import { BRAND } from "@/config/brand";
import { launchFeed } from "@/lib/agent/data";
import { chainStat } from "@/lib/chainstat";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({
  title: "All launches",
  description: `Every token ${BRAND.name} has launched on Pons: name, pair, launch time, market cap and what the dev side holds of it, read from the chain.`,
  path: "/launches",
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "eth", label: "ETH pairs" },
  { key: "stock", label: "Stock pairs" },
  { key: "breaking", label: "Breaking" },
] as const;

export default async function LaunchesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show = "all" } = await searchParams;
  const now = requestNow();
  const [feed, stat] = await Promise.all([launchFeed(now), chainStat().catch(() => null)]);
  const list = feed.launches.filter((l) =>
    show === "eth" ? l.pair.symbol === "ETH" : show === "stock" ? l.pair.symbol !== "ETH" && l.pair.symbol !== "USDG" : show === "breaking" ? l.lane === "breaking" : true,
  );
  return (
    <main className="wrap">
      <JsonLd data={breadcrumbs([{ name: "All launches", path: "/launches" }])} />
      <div className="page-h">
        <h1>All launches</h1>
        <p>
          Every token the agent has put on Pons. A token appears here only when the launcher contract has a record of it, so this list cannot contain a launch
          that did not happen.
        </p>
      </div>
      <div className="grid gap-5 pt-8">
        {feed.mode === "sample" ? (
          <SampleBanner>The launcher is not deployed yet, so this list shows sample launches. None of these tokens exist and none has an address.</SampleBanner>
        ) : (
          <p className="m-0 flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <ChainTag /> {feed.launches.length} launches read from the launcher contract. {feed.error ?? ""}
          </p>
        )}
        <nav aria-label="Filter launches" className="seg w-fit">
          {FILTERS.map((f) => (
            <Link key={f.key} href={f.key === "all" ? "/launches" : `/launches?show=${f.key}`} className={show === f.key ? "on" : ""} aria-current={show === f.key ? "true" : undefined}>
              {f.label}
            </Link>
          ))}
        </nav>
        <LaunchTable launches={list} ethUsd={stat?.ethUsd ?? null} now={now} />
        <p className="m-0 text-[13px] text-ink-2">
          Dev holds is the sum of what the launcher contract, the treasury and the agent&apos;s wallet hold of each token, read live. Market cap is shown for
          ETH-paired launches; stock-paired ones are priced in their stock.
        </p>
      </div>
    </main>
  );
}
