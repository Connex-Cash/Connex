"use client";

import { useEffect, useState } from "react";

const ROUND_MS = 30 * 60 * 1000;

export function useNow(step = 1000) {
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

export type ChainStatJson = {
  block: number | null;
  gasGwei: number | null;
  ethUsd: number | null;
  at: number;
  treasury: { deployed: boolean; wei: string | null };
};

const listeners = new Set<(s: ChainStatJson) => void>();
let lastStat: ChainStatJson | null = null;
let poller: number | undefined;

function poll() {
  fetch("/api/chain", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((s: ChainStatJson | null) => {
      if (!s) return;
      lastStat = s;
      listeners.forEach((f) => f(s));
    })
    .catch(() => {});
}

/** One shared poll of /api/chain (every 15 s) for the header gauge and the footer line. */
export function useChainStat() {
  const [stat, setStat] = useState<ChainStatJson | null>(null);
  useEffect(() => {
    listeners.add(setStat);
    const first = window.setTimeout(() => (lastStat ? setStat(lastStat) : poll()), 0);
    if (poller === undefined) poller = window.setInterval(poll, 15_000);
    return () => {
      window.clearTimeout(first);
      listeners.delete(setStat);
      if (!listeners.size) {
        window.clearInterval(poller);
        poller = undefined;
      }
    };
  }, []);
  return stat;
}

const MILESTONES = [10e3, 50e3, 100e3, 250e3, 500e3, 1e6, 2.5e6, 5e6, 10e6];
const MAJOR = new Set([10e3, 250e3, 1e6, 10e6]);
const label = (v: number) => (v >= 1e6 ? `$${v / 1e6}M` : `$${v / 1e3}K`);

/** Treasury value in dollars against fixed milestones, under the nav. */
export function Gauge() {
  const stat = useChainStat();
  const wei = stat?.treasury.wei ? BigInt(stat.treasury.wei) : 0n;
  const usd = stat?.ethUsd ? (Number(wei) / 1e18) * stat.ethUsd : 0;
  // Each milestone sits at an equal step; the fill moves linearly between them.
  const step = 100 / MILESTONES.length;
  let fill = 0;
  for (let i = 0; i < MILESTONES.length; i++) {
    const lo = i === 0 ? 0 : MILESTONES[i - 1];
    const hi = MILESTONES[i];
    if (usd >= hi) fill = (i + 1) * step;
    else {
      fill = i * step + ((usd - lo) / (hi - lo)) * step;
      break;
    }
  }
  fill = Math.max(0, Math.min(100, fill));
  const next = MILESTONES.find((m) => m > usd) ?? null;
  const deployed = stat?.treasury.deployed ?? false;
  return (
    <div className="gauge" aria-label="Treasury tracker">
      <div className="wrap">
        <div>
          <div className="g-lbl">{deployed ? "Treasury" : "Treasury · not deployed"}</div>
          <div className="g-val" data-testid="gauge-value">
            {stat ? `$${Math.round(usd).toLocaleString("en-US")}` : "$0"}
          </div>
        </div>
        <div className="g-track">
          <div className="g-bar">
            <i style={{ width: `${fill}%` }} />
          </div>
          <div className="g-flare" style={{ left: `${fill}%` }} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="g-ticks">
            {MILESTONES.map((m, i) => (
              <span
                key={m}
                className={`g-tick ${usd >= m ? "hit" : ""} ${m === 1e6 ? "star" : ""} ${MAJOR.has(m) ? "" : "minor"}`}
                style={{ left: i === MILESTONES.length - 1 ? "calc(100% - 14px)" : `${(i + 1) * step}%` }}
                title={`$${m.toLocaleString("en-US")}`}
              >
                {label(m)}
              </span>
            ))}
          </div>
        </div>
        <div className="g-next">
          <div className="g-lbl">{next ? `Next: ${label(next)}` : "Every milestone hit"}</div>
          <div className="g-v num">{next ? `$${Math.max(0, Math.round(next - usd)).toLocaleString("en-US")} to go` : "–"}</div>
        </div>
      </div>
    </div>
  );
}

/** The mono line in the footer: block, gas, ETH and when it was read. */
export function ChainLine() {
  const stat = useChainStat();
  return (
    <div className="mono" style={{ fontSize: 12 }} suppressHydrationWarning>
      {stat
        ? `block ${stat.block?.toLocaleString("en-US") ?? "…"} · gas ${stat.gasGwei != null ? stat.gasGwei.toFixed(stat.gasGwei < 0.01 ? 4 : 3) : "…"} gwei · ETH ${
            stat.ethUsd ? `$${Math.round(stat.ethUsd).toLocaleString("en-US")}` : "…"
          } · read ${new Date(stat.at).toISOString().slice(11, 19)} UTC`
        : "Reading Robinhood Chain…"}
    </div>
  );
}
