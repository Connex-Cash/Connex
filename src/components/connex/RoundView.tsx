"use client";

import { useEffect, useState } from "react";
import { CHAIN } from "@/config/brand";
import { SampleTag, ChainTag, TokenAvatar } from "@/components/ui";
import { NextRound } from "@/components/site/StatusStrip";
import { STEP_INFO, type Round, type StepState } from "@/lib/agent/types";
import { hhmm, utc } from "@/lib/format";

const MARK: Record<StepState, string> = { done: "✓", running: "●", waiting: "○", skipped: "–", failed: "!" };
const STATE_WORD: Record<StepState, string> = { done: "done", running: "running", waiting: "waiting", skipped: "skipped", failed: "failed" };

/** Refreshes the current round every 20 seconds. */
export function useRound(initial: Round) {
  const [round, setRound] = useState(initial);
  useEffect(() => {
    let stop = false;
    const t = window.setInterval(() => {
      fetch("/api/round", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((r: Round | null) => !stop && r && setRound(r))
        .catch(() => {});
    }, 20_000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, []);
  return round;
}

export function RoundHeader({ round }: { round: Round }) {
  const outcome =
    round.outcome === "running" ? "In progress" : round.outcome === "launched" ? "Launched" : round.outcome === "skipped" ? "Skipped: nothing passed the check" : "Failed";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="num text-[13px] text-ink-2">Round {utc(round.startsAt)}</span>
        {round.mode === "sample" ? <SampleTag>sample round</SampleTag> : <ChainTag>agent log</ChainTag>}
        <span className={`tag ${round.outcome === "running" ? "border-signal text-signal-ink" : ""}`}>{outcome}</span>
      </div>
      <span className="text-[13px] text-ink-2">
        next round in <NextRound className="font-semibold text-ink" />
      </span>
    </div>
  );
}

export function StepList({ round, compact = false }: { round: Round; compact?: boolean }) {
  return (
    <ol className="steps" aria-label="Steps of this round">
      {round.steps.map((s, i) => {
        const info = STEP_INFO[s.key];
        return (
          <li key={s.key} data-state={s.state}>
            <span className={`n ${s.state === "running" ? "!text-signal-ink" : s.state === "done" ? "!text-go" : ""}`} aria-label={STATE_WORD[s.state]}>
              {MARK[s.state]} {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h3 className={s.state === "waiting" ? "text-ink-4" : ""}>{info.title}</h3>
              {compact ? null : <p className="text-[14px]">{info.plain}</p>}
              {!compact && s.lines.length ? (
                <ul className="log mt-2">
                  {s.lines.map((l, j) => (
                    <li key={j} className={l.tone === "ok" ? "ok" : l.tone === "warn" ? "warn" : ""}>
                      <span className="at">{hhmm(l.at)}</span>
                      <span className="mk">{l.tone === "warn" ? "!" : l.tone === "ok" ? "✓" : "·"}</span>
                      <span className="body">
                        {l.text}
                        {l.tx ? (
                          <>
                            {" "}
                            <a className="tlink" href={`${CHAIN.explorer}/tx/${l.tx}`} target="_blank" rel="noreferrer">
                              view transaction
                            </a>
                          </>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <span className="t">{s.state === "waiting" ? `≤ ${info.budgetMin} min` : s.at ? hhmm(s.at) : STATE_WORD[s.state]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Candidates({ round }: { round: Round }) {
  if (!round.candidates.length) return <p className="note m-0">Candidates appear once the research step has read the feed.</p>;
  return (
    <div className="tbl-wrap">
      <table className="tbl min-w-[640px]">
        <thead>
          <tr>
            <th>Topic</th>
            <th className="r">Momentum</th>
            <th className="r">Meme</th>
            <th className="r">Fresh</th>
            <th className="r">Trader</th>
            <th className="r">Score</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {round.candidates.map((c) => (
            <tr key={c.topic}>
              <td className="max-w-[320px]">
                <b className="block">{c.topic}</b>
                <span className="text-[12.5px] text-ink-2">{c.source}</span>
              </td>
              <td className="num r">{c.momentum}</td>
              <td className="num r">{c.memeability}</td>
              <td className="num r">{c.originality}</td>
              <td className={`num r ${c.appeal >= 8 ? "text-go" : "text-down"}`}>{c.appeal}/10</td>
              <td className="num r font-semibold">{c.score.toFixed(1)}</td>
              <td className="text-[13px]">
                <b className={c.passed ? "text-go" : "text-ink-2"}>{c.passed ? "Picked" : "Passed over"}</b>
                <span className="block text-ink-2">{c.note}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RoundToken({ round }: { round: Round }) {
  const t = round.token;
  if (!t) {
    return (
      <div className="panel p-5">
        <p className="m-0 text-[14px] text-ink-2">{round.outcome === "skipped" ? "No token this round. A weak coin is worse than no coin." : "Not named yet. The token appears here once a topic passes the trader check."}</p>
      </div>
    );
  }
  return (
    <div className="panel grid gap-3 p-5">
      <div className="flex items-center gap-3">
        <TokenAvatar symbol={t.symbol} logo={t.logo} size={48} />
        <div className="min-w-0">
          <b className="block font-display text-[22px] leading-tight">{t.name}</b>
          <span className="num text-[13px] text-ink-2">
            ${t.symbol} · {t.pair} pair
          </span>
        </div>
      </div>
      <p className="m-0 text-[15px]">{t.description}</p>
      <p className="m-0 text-[13px] text-ink-2">{t.pairReason}</p>
      {t.address ? (
        <a className="tlink num text-[13px] break-all" href={`${CHAIN.explorer}/token/${t.address}`} target="_blank" rel="noreferrer">
          {t.address}
        </a>
      ) : round.mode === "sample" ? (
        <p className="m-0 text-[12.5px] text-ink-4">Sample: this token does not exist and has no address.</p>
      ) : null}
    </div>
  );
}

/** The whole live round, refreshed in place. */
export function LiveRound({ initial }: { initial: Round }) {
  const round = useRound(initial);
  return (
    <div className="grid gap-8">
      <RoundHeader round={round} />
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <StepList round={round} />
        </div>
        <aside className="grid content-start gap-4 lg:sticky lg:top-[110px]">
          <h2 className="m-0 text-[20px]">This round&apos;s token</h2>
          <RoundToken round={round} />
        </aside>
      </div>
      <section aria-labelledby="cand-h" className="grid gap-4">
        <h2 id="cand-h" className="m-0 text-[24px]">
          Topics it weighed
        </h2>
        <p className="m-0 max-w-[70ch] text-ink-2">
          Each topic is rated on four scales of 0 to 10. The trader score is a gate: under 8, the topic is out however well it scores elsewhere. The rest is a
          weighted mix set by the playbook.
        </p>
        <Candidates round={round} />
      </section>
    </div>
  );
}
