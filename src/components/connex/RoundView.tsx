"use client";

import { useEffect, useState } from "react";
import { CHAIN } from "@/config/brand";
import { NextRound } from "@/components/site/StatusStrip";
import { STEP_INFO, type Round, type StepState } from "@/lib/agent/types";
import { hhmm } from "@/lib/format";

const CLS: Record<StepState, string> = { done: "done", running: "now", waiting: "wait", skipped: "skip", failed: "fail" };

/** Refreshes the current round every 20 seconds. */
export function useRound(initial: Round, live = true) {
  const [round, setRound] = useState(initial);
  useEffect(() => {
    if (!live) return;
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
  }, [live]);
  return round;
}

export function phaseText(round: Round) {
  if (round.outcome === "running") {
    const step = round.steps.find((s) => s.state === "running");
    return step ? `Working: ${STEP_INFO[step.key].title.toLowerCase()}` : "Starting up";
  }
  if (round.outcome === "launched") return "Launched, next round soon";
  if (round.outcome === "skipped") return "Skipped: no topic passed the trader check";
  return "Round failed, the log says why";
}

export function RoundSummary({ round }: { round: Round }) {
  const picked = round.candidates.find((c) => c.passed);
  const collect = round.steps.find((s) => s.key === "collect");
  return (
    <div className="summary">
      <div className="sum">
        <div className="k">Round</div>
        <div className="v">{hhmm(round.startsAt)} UTC</div>
        <div className="s">
          {round.outcome === "running"
            ? "In progress"
            : round.outcome === "launched"
              ? "Launched"
              : round.outcome === "skipped"
                ? "Ended without a launch"
                : "Stopped"}
        </div>
      </div>
      <div className={`sum ${picked ? "hl" : ""}`}>
        <div className="k">Topic picked</div>
        <div className="v">{picked ? picked.topic : round.outcome === "skipped" ? "None" : "…"}</div>
        <div className="s">{picked ? `Weighted score ${picked.score.toFixed(1)}` : round.candidates.length ? "Still under review" : "Reading the feed"}</div>
      </div>
      <div className="sum">
        <div className="k">Token</div>
        <div className="v">{round.token ? `${round.token.name}` : "…"}</div>
        <div className="s">{round.token ? `$${round.token.symbol} · ${round.token.pair} pair` : "No name yet"}</div>
      </div>
      <div className="sum">
        <div className="k">Fees</div>
        <div className="v">{collect?.state === "done" ? "Split 50/50" : "–"}</div>
        <div className="s">Swept into the treasury each round</div>
      </div>
    </div>
  );
}

export function StepTimeline({ round }: { round: Round }) {
  return (
    <ol className="tl" aria-label="Steps of this round">
      {round.steps.map((s, i) => {
        const info = STEP_INFO[s.key];
        const mark = s.state === "done" ? "✓" : s.state === "skipped" ? "–" : s.state === "failed" ? "!" : String(i + 1);
        const isName = s.key === "name" && round.token && s.state !== "waiting";
        return (
          <li key={s.key} className={`step ${CLS[s.state]}`} data-state={s.state}>
            <span className="ic">{mark}</span>
            <div className="step-h">
              <h3>{info.title}</h3>
              {s.at ? <time>{hhmm(s.at)}</time> : <span className="bud">up to {info.budgetMin} min</span>}
            </div>
            {s.state !== "waiting" && (s.lines.length || isName) ? (
              <div className="step-b">
                {s.lines.map((l, j) => (
                  <div key={j} className={`it ${l.tone === "ok" ? "good" : l.tone === "warn" ? "warn" : ""}`}>
                    <span className="m">{l.tone === "ok" ? "✓" : l.tone === "warn" ? "!" : "•"}</span>
                    <span>
                      {l.text}
                      {l.tx ? (
                        <>
                          {" "}
                          <a href={`${CHAIN.explorer}/tx/${l.tx}`} target="_blank" rel="noreferrer">
                            see the transaction
                          </a>
                        </>
                      ) : null}
                      {j === 0 ? <span className="small">{info.plain}</span> : null}
                    </span>
                  </div>
                ))}
                {isName && round.token ? (
                  <div className="it">
                    <span className="m">“</span>
                    <span>
                      {round.token.description}
                      <span className="small">{round.token.pairReason}</span>
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function CandidatePanel({ round, title = "Topics it weighed" }: { round: Round; title?: string }) {
  return (
    <div className="panel pad stick">
      <h3 style={{ marginBottom: 4 }}>{title}</h3>
      <p className="faint" style={{ margin: "0 0 6px", fontSize: 13.5 }}>
        Rated 0 to 10 on momentum, meme value, freshness and the trader&apos;s gut. Under 8 from the trader means out.
      </p>
      {round.candidates.length ? (
        round.candidates.map((c) => (
          <div className="cand" key={c.topic}>
            <div className="cand-top">
              <b>{c.topic}</b>
              <span className="num">{c.score.toFixed(1)}</span>
            </div>
            <span className={`meter ${c.passed ? "" : "mute"}`}>
              <i style={{ width: `${Math.min(100, c.score * 10)}%` }} />
            </span>
            <small>
              {c.passed ? "Picked. " : "Passed over. "}
              {c.note || c.source}
            </small>
            <small className="mono">
              momentum {c.momentum} · meme {c.memeability} · fresh {c.originality} · trader {c.appeal}/10
            </small>
          </div>
        ))
      ) : (
        <div className="empty">Topics show up here once the research step has read the feed.</div>
      )}
    </div>
  );
}

/** The whole current round, refreshed in place. */
export function LiveRound({ initial }: { initial: Round }) {
  const round = useRound(initial);
  return (
    <>
      <RoundSummary round={round} />
      <div className="cols2" style={{ marginTop: 20 }}>
        <StepTimeline round={round} />
        <CandidatePanel round={round} />
      </div>
    </>
  );
}

/** The phase chip in the band head, refreshed with the round. */
export function PhaseChip({ initial }: { initial: Round }) {
  const round = useRound(initial);
  return (
    <span className="chip" data-testid="phase">
      <span className="blip" /> {phaseText(round)} · next in <NextRound />
    </span>
  );
}
