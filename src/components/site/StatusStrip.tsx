"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CHAIN } from "@/config/brand";

const ROUND_MS = 30 * 60 * 1000;

function useNow(step = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const t = window.setInterval(() => setNow(Date.now()), step);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, [step]);
  return now;
}

export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Time to the next :00 or :30 UTC. Renders a placeholder until the client clock is known. */
export function NextRound({ className = "" }: { className?: string }) {
  const now = useNow();
  const left = now === null ? null : ROUND_MS - (now % ROUND_MS);
  return (
    <span className={`num ${className}`} suppressHydrationWarning>
      {left === null ? "--:--" : countdown(left)}
    </span>
  );
}

type Stat = { block: number | null; gasGwei: number | null; ethUsd: number | null };

export function StatusStrip() {
  const [stat, setStat] = useState<Stat | null>(null);
  useEffect(() => {
    let stop = false;
    const load = () =>
      fetch("/api/chain", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((s) => !stop && s && setStat(s))
        .catch(() => {});
    load();
    const t = window.setInterval(load, 15_000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);
  return (
    <div className="bg-ink text-inkfg">
      <div className="wrap flex h-[30px] items-center justify-between gap-4 overflow-hidden font-mono text-[12px]">
        <Link href="/round" className="flex min-w-0 items-center gap-2 no-underline">
          <i className="dot dot-signal live-dot" aria-hidden="true" />
          <span className="truncate">
            next round in <NextRound className="font-semibold" />
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-4 opacity-80">
          <span className="hidden sm:inline">{CHAIN.name}</span>
          <span title="Latest block" className="hidden md:inline">
            block {stat?.block ? stat.block.toLocaleString("en-US") : "…"}
          </span>
          <span title="Gas price" className="hidden md:inline">
            gas {stat?.gasGwei != null ? `${stat.gasGwei < 0.01 ? stat.gasGwei.toFixed(4) : stat.gasGwei.toFixed(3)} gwei` : "…"}
          </span>
          <span title="ETH price">ETH {stat?.ethUsd ? `$${Math.round(stat.ethUsd).toLocaleString("en-US")}` : "…"}</span>
        </div>
      </div>
    </div>
  );
}
