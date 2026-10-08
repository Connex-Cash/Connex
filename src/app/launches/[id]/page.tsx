import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyText } from "@/components/CopyCa";
import { StepTimeline } from "@/components/connex/RoundView";
import { devHoldsText, launchNo, laneText, mcapUsd, pairKind, stageText } from "@/components/connex/launchView";
import { TokenArt } from "@/components/ui";
import { BRAND, CHAIN, PONS } from "@/config/brand";
import { CONTRACTS, OPERATOR } from "@/config/contracts";
import { launchById, launchFeed } from "@/lib/agent/data";
import { sampleRound } from "@/lib/agent/sample";
import { STEP_KEYS, type Launch, type Round } from "@/lib/agent/types";
import { chainStat } from "@/lib/chainstat";
import { usd, utc } from "@/lib/format";

export const dynamic = "force-dynamic";

const isId = (id: string) => /^s-\d{1,10}$/.test(id) || /^0x[0-9a-fA-F]{40}$/.test(id);
const X_STATUS = /^https:\/\/x\.com\/(i\/web\/status|[A-Za-z0-9_]{1,15}\/status)\/\d{1,25}$/;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const l = isId(id) ? await launchById(id) : null;
  return {
    title: l ? `${l.name} ($${l.symbol})` : "Launch",
    description: l ? `${l.name} ($${l.symbol}), launched by ${BRAND.name} on Pons: the story, the pair, the scores and what the dev side holds.` : undefined,
    robots: { index: false, follow: true },
  };
}

/** The round log behind a launch: the sample round itself, or what the chain and the keeper recorded. */
function roundFor(l: Launch): Round {
  if (l.mode === "sample" && l.round !== null) return sampleRound(l.round, l.launchedAt + 10 * 60 * 1000);
  const at = l.launchedAt;
  const lines: Record<string, Round["steps"][number]["lines"]> = {
    research: l.source ? [{ at, text: `Found on: ${l.source.label}.`, tone: "info" }] : [],
    check: l.scores ? [{ at, text: `Trader check ${l.scores.appeal}/10; weighted score ${l.scores.score.toFixed(1)}.`, tone: "ok" }] : [],
    name: [{ at, text: `Named it ${l.name} ($${l.symbol}).`, tone: "ok" }],
    pair: [{ at, text: `Pair: ${l.pair.symbol}.`, tone: "ok" }],
    launch: [{ at, text: `Launched on Pons through the ${BRAND.name} launcher at ${l.address}.`, tone: "ok", tx: l.tx ?? null }],
  };
  return {
    id: l.id,
    number: l.round ?? 0,
    startsAt: at,
    mode: "live",
    steps: STEP_KEYS.map((key) => ({ key, state: lines[key] ? "done" : "waiting", at: lines[key] ? at : null, lines: lines[key] ?? [] })),
    candidates: l.scores ? [l.scores] : [],
    token: null,
    outcome: "launched",
  };
}

function Bal({ label, who, v }: { label: string; who: string | null; v: string | null | undefined }) {
  return (
    <div>
      <dt>
        {label}
        {who ? (
          <a className="tlink num block w-fit text-[12px]" href={`${CHAIN.explorer}/address/${who}`} target="_blank" rel="noreferrer">
            {who.slice(0, 10)}…
          </a>
        ) : null}
      </dt>
      <dd>{v == null ? "not set" : v === "unknown" ? "unread" : (Number(BigInt(v)) / 1e18).toLocaleString("en-US")}</dd>
    </div>
  );
}

export default async function LaunchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const [feed, stat] = await Promise.all([launchFeed(), chainStat().catch(() => null)]);
  const at = feed.launches.findIndex((x) => x.id.toLowerCase() === id.toLowerCase());
  if (at < 0) notFound();
  const l = feed.launches[at];
  const newer = feed.launches[at - 1] ?? null;
  const older = feed.launches[at + 1] ?? null;
  const holds = devHoldsText(l);
  const mcap = mcapUsd(l, stat?.ethUsd ?? null);
  const round = roundFor(l);
  const sc = l.scores;
  return (
    <main>
      <section className="band first">
        <div className="wrap">
          <Link className="back" href="/launches">
            ← All launches
          </Link>
          <div className="detail-h">
            <TokenArt symbol={l.symbol} />
            <div style={{ minWidth: 0 }}>
              <div className="faint mono" style={{ fontSize: 12.5 }}>
                Launch {launchNo(l)} · {utc(l.launchedAt)} · {laneText(l).toLowerCase()}
                {l.mode === "sample" ? " · sample" : ""}
              </div>
              <h1 className="title" style={{ marginTop: 8 }}>
                {l.name}{" "}
                <span className="faint mono" style={{ fontSize: "0.55em" }}>
                  ${l.symbol}
                </span>
              </h1>
              {l.description ? <p className="why">{l.description}</p> : null}
              <div className="kv">
                <div>
                  <div className="k">Market cap</div>
                  <div className="v">
                    {l.mode === "sample" ? "–" : l.market ? usd(mcap) : pairKind(l.pair.symbol) === "eth" ? "unread" : `in ${l.pair.symbol}`}
                  </div>
                </div>
                <div>
                  <div className="k">Stage</div>
                  <div className="v">{stageText(l)}</div>
                </div>
                <div>
                  <div className="k">Fees earned</div>
                  <div className="v">{l.mode === "sample" ? `≈${l.sampleFeesEth}` : "–"}</div>
                </div>
                <div>
                  <div className="k">Pair</div>
                  <div className="v">{l.pair.symbol}</div>
                </div>
                <div>
                  <div className="k">Dev holds</div>
                  <div className="v">{holds.text}</div>
                </div>
              </div>
              <div className="lrow" style={{ border: 0, padding: "12px 0 0", display: "flex", flexWrap: "wrap", gap: 14, cursor: "auto", background: "none" }}>
                <div className="st">
                  <span className="chip rh">Robinhood</span>
                  <span className={`chip ${pairKind(l.pair.symbol) === "stock" ? "stock" : "eth"}`}>{l.pair.symbol}</span>
                  {l.lane === "breaking" ? <span className="chip brk">breaking</span> : null}
                  {holds.ok ? <span className="chip good">dev 0, checked</span> : null}
                  {l.mode === "sample" ? <span className="chip smp">sample</span> : null}
                </div>
                <div className="ln" style={{ display: "flex" }}>
                  {l.address ? (
                    <>
                      <a href={PONS.page(l.address)} target="_blank" rel="noreferrer">
                        pons
                      </a>
                      <a href={`${CHAIN.explorer}/token/${l.address}`} target="_blank" rel="noreferrer">
                        chain
                      </a>
                      {l.tx ? (
                        <a href={`${CHAIN.explorer}/tx/${l.tx}`} target="_blank" rel="noreferrer">
                          tx
                        </a>
                      ) : null}
                      <CopyText value={l.address} label={`$${l.symbol} address`} />
                    </>
                  ) : (
                    <span>no address: this token does not exist</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="summary">
            <div className="sum">
              <div className="k">Round</div>
              <div className="v">{l.lane === "breaking" ? "Breaking" : utc(round.startsAt).split(", ")[1]}</div>
              <div className="s">{l.lane === "breaking" ? "Ran between rounds" : "Half-hour slot"}</div>
            </div>
            <div className="sum hl">
              <div className="k">Topic</div>
              <div className="v">{sc ? sc.topic : "–"}</div>
              <div className="s">
                {l.source?.url && X_STATUS.test(l.source.url) ? (
                  <a className="tlink" href={l.source.url} target="_blank" rel="noreferrer">
                    {l.source.label}
                  </a>
                ) : (
                  (l.source?.label ?? "Source not recorded")
                )}
              </div>
            </div>
            <div className="sum">
              <div className="k">Score</div>
              <div className="v">{sc ? sc.score.toFixed(1) : "–"}</div>
              <div className="s">{sc ? `trader ${sc.appeal}/10` : "no scores recorded"}</div>
            </div>
            <div className="sum">
              <div className="k">Dev holds</div>
              <div className="v">{holds.text}</div>
              <div className="s">{l.mode === "sample" ? "sample, nothing to read" : "launcher + treasury + agent wallet"}</div>
            </div>
          </div>
          <div className="cols2" style={{ marginTop: 20 }}>
            <StepTimeline round={round} />
            <div className="panel pad stick">
              <h3 style={{ marginBottom: 4 }}>Who holds it on the dev side</h3>
              <p className="faint" style={{ margin: "0 0 10px", fontSize: 13.5 }}>
                Read from the chain for every launch. Anything other than zero would show here in red.
              </p>
              {l.mode === "chain" && l.devHolds ? (
                <dl className="rows">
                  <Bal label="Launcher contract" who={CONTRACTS.launcher} v={l.devHolds.launcher} />
                  <Bal label="Treasury contract" who={CONTRACTS.treasury} v={l.devHolds.treasury} />
                  <Bal label="Agent wallet" who={OPERATOR || null} v={l.devHolds.operator} />
                </dl>
              ) : (
                <div className="empty">For a real launch this lists the launcher, treasury and agent wallet balances.</div>
              )}
              {sc ? (
                <div className="cand">
                  <div className="cand-top">
                    <b>Weighted score</b>
                    <span className="num">{sc.score.toFixed(1)}</span>
                  </div>
                  <span className="meter">
                    <i style={{ width: `${Math.min(100, sc.score * 10)}%` }} />
                  </span>
                  <small className="mono">
                    momentum {sc.momentum} · meme {sc.memeability} · fresh {sc.originality} · trader {sc.appeal}/10
                  </small>
                </div>
              ) : null}
              {l.mode === "chain" ? (
                <dl className="rows" style={{ marginTop: 12 }}>
                  <div>
                    <dt>Evidence hash</dt>
                    <dd className="text-[12px]">{l.sourceHash}</dd>
                  </div>
                  <div>
                    <dt>Playbook hash</dt>
                    <dd className="text-[12px]">{l.playbookHash}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
          </div>
          <div className="pager">
            <span>
              {older ? (
                <Link href={`/launches/${older.id}`}>
                  ← {launchNo(older)} {older.name}
                </Link>
              ) : null}
            </span>
            <span>
              {newer ? (
                <Link href={`/launches/${newer.id}`}>
                  {launchNo(newer)} {newer.name} →
                </Link>
              ) : null}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
