"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { TokenArt } from "@/components/ui";
import { CHAIN, PONS } from "@/config/brand";
import type { Launch } from "@/lib/agent/types";
import { ago, usd, utc } from "@/lib/format";
import { devHoldsText, launchNo, laneText, mcapUsd, pairKind, stageText } from "./launchView";

function Row({ l, ethUsd, now }: { l: Launch; ethUsd: number | null; now: number }) {
  const router = useRouter();
  const href = `/launches/${l.id}`;
  const holds = devHoldsText(l);
  const mcap = mcapUsd(l, ethUsd);
  const kind = pairKind(l.pair.symbol);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div className="lrow" onClick={() => router.push(href)} data-testid="launch-row">
      <TokenArt symbol={l.symbol} className="thumb" />
      <span className="n c-n">{launchNo(l)}</span>
      <div className="tok c-tok">
        <TokenArt symbol={l.symbol} />
        <div style={{ minWidth: 0 }}>
          <Link href={href} onClick={stop}>
            <b>{l.name}</b>
          </Link>
          <small>
            ${l.symbol} · {l.pair.symbol} pair
          </small>
          <small className="mono" style={{ opacity: 0.75 }} title={utc(l.launchedAt)}>
            {utc(l.launchedAt).replace(" UTC", "")} · {ago(l.launchedAt, now)} ago
          </small>
        </div>
      </div>
      <span className="src c-src">{laneText(l)}</span>
      <span className="r c-mc">
        {l.mode === "sample" ? "–" : mcap !== null ? usd(mcap) : kind === "eth" ? "…" : `in ${l.pair.symbol}`}
        <span className="k">mcap</span>
      </span>
      <span className="r c-ath">{stageText(l)}</span>
      <span className="r c-fees">
        {l.mode === "sample" ? `≈${l.sampleFeesEth}` : "–"}
        <span className="k">{l.mode === "sample" ? "ETH fees" : "fees"}</span>
      </span>
      <div className="st c-st">
        <span className="chip rh">Robinhood</span>
        <span className={`chip ${kind === "stock" ? "stock" : "eth"}`}>{l.pair.symbol}</span>
        {l.lane === "breaking" ? <span className="chip brk">breaking</span> : null}
        {holds.ok === true ? <span className="chip good">dev 0</span> : holds.ok === false ? <span className="chip bad">dev {holds.text}</span> : null}
        {l.mode === "sample" ? <span className="chip smp">sample</span> : null}
      </div>
      <div className="ln c-ln">
        {l.address ? (
          <>
            <a href={PONS.page(l.address)} target="_blank" rel="noreferrer" onClick={stop}>
              pons
            </a>
            <a href={`${CHAIN.explorer}/token/${l.address}`} target="_blank" rel="noreferrer" onClick={stop}>
              chain
            </a>
            {l.tx ? (
              <a href={`${CHAIN.explorer}/tx/${l.tx}`} target="_blank" rel="noreferrer" onClick={stop}>
                tx
              </a>
            ) : null}
          </>
        ) : (
          <span>no address · sample</span>
        )}
      </div>
    </div>
  );
}

function Head() {
  return (
    <div className="lrow head">
      <span>#</span>
      <span>Token</span>
      <span className="c-src">Source</span>
      <span className="r">Mcap</span>
      <span className="r">Stage</span>
      <span className="r">Fees</span>
      <span>Status</span>
      <span className="c-ln">Links</span>
    </div>
  );
}

export function LaunchTable({
  launches,
  ethUsd,
  now,
  limit,
  empty,
  foot,
}: {
  launches: Launch[];
  ethUsd: number | null;
  now: number;
  limit?: number;
  empty?: string;
  foot?: React.ReactNode;
}) {
  const rows = limit ? launches.slice(0, limit) : launches;
  return (
    <div className="ltable" data-testid="launch-table">
      <Head />
      {rows.length ? (
        rows.map((l) => <Row key={l.id} l={l} ethUsd={ethUsd} now={now} />)
      ) : (
        <div className="empty">{empty ?? "No launches yet. The first one shows up here once the launcher contract records it."}</div>
      )}
      {foot ? <div className="lfoot">{foot}</div> : null}
    </div>
  );
}

const SORTS = [
  ["date", "Newest"],
  ["fees", "Fees"],
  ["stage", "Stage"],
  ["mcap", "Mcap"],
] as const;
const SOURCES = [
  ["all", "All"],
  ["eth", "ETH"],
  ["stock", "Stock"],
  ["breaking", "Breaking"],
] as const;

/** The full list with sort, source filter and search, as on /launches. */
export function LaunchExplorer({
  launches,
  ethUsd,
  now,
  initialShow = "all",
}: {
  launches: Launch[];
  ethUsd: number | null;
  now: number;
  initialShow?: string;
}) {
  const [sort, setSort] = useState<(typeof SORTS)[number][0]>("date");
  const [show, setShow] = useState(SOURCES.some(([k]) => k === initialShow) ? initialShow : "all");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = launches.filter((l) => {
      const k = pairKind(l.pair.symbol);
      if (show === "eth" && k !== "eth") return false;
      if (show === "stock" && k !== "stock") return false;
      if (show === "breaking" && l.lane !== "breaking") return false;
      return !needle || l.name.toLowerCase().includes(needle) || l.symbol.toLowerCase().includes(needle);
    });
    const fee = (l: Launch) => l.sampleFeesEth ?? 0;
    if (sort === "fees") out.sort((a, b) => fee(b) - fee(a));
    else if (sort === "stage")
      out.sort((a, b) => (b.market?.phase ?? -1) * 100 + (b.market?.progress ?? 0) - ((a.market?.phase ?? -1) * 100 + (a.market?.progress ?? 0)));
    else if (sort === "mcap") out.sort((a, b) => (b.market?.mcapEth ?? 0) - (a.market?.mcapEth ?? 0));
    else out.sort((a, b) => b.launchedAt - a.launchedAt);
    return out;
  }, [launches, sort, show, q]);
  const total = launches.reduce((a, l) => a + (l.sampleFeesEth ?? 0), 0);
  const sample = launches.some((l) => l.mode === "sample");
  return (
    <>
      <div className="filters">
        <div className="seg" role="group" aria-label="Sort">
          {SORTS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Pair or lane">
          {SOURCES.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>
              {label}
            </button>
          ))}
        </div>
        <label className="find">
          <span className="faint">⌕</span>
          <input
            type="search"
            placeholder="Find a name or ticker"
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Find a launch"
          />
        </label>
      </div>
      <LaunchTable
        launches={list}
        ethUsd={ethUsd}
        now={now}
        empty="Nothing matches this filter."
        foot={
          <>
            <span>
              Showing <b>{list.length}</b> of <b>{launches.length}</b>
            </span>
            {sample ? (
              <span>
                Sample creator fees <b>≈{total.toFixed(3)} ETH</b>
              </span>
            ) : (
              <span>
                Dev holds across every launch: <b>{launches.every((l) => devHoldsText(l).ok) ? "0" : "see rows"}</b>
              </span>
            )}
          </>
        }
      />
    </>
  );
}
