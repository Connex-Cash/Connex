import Link from "next/link";
import { requestNow } from "@/lib/now";
import { CaPill, CopyText } from "@/components/CopyCa";
import { HeroScene } from "@/components/connex/HeroScene";
import { LaunchTable } from "@/components/connex/LaunchList";
import { devHoldsText, launchNo, laneText, mcapUsd, stageText } from "@/components/connex/launchView";
import { PonsBoard } from "@/components/connex/PonsBoard";
import { SplitPanel } from "@/components/connex/Treasury";
import { NextRound } from "@/components/site/StatusStrip";
import { BandHead, TokenArt, XGlyph } from "@/components/ui";
import { BRAND, CHAIN, hasX } from "@/config/brand";
import { DEPLOY_DEFAULTS, buybackLive } from "@/config/contracts";
import { claims, launchFeed, playbook } from "@/lib/agent/data";
import { chainStat } from "@/lib/chainstat";
import { ago, eth, usd } from "@/lib/format";
import { readPonsLatest, readTreasury } from "@/lib/onchain/read";

export const revalidate = 30;

const pct = DEPLOY_DEFAULTS.buybackShareBps / 100;

export default async function Home() {
  const now = requestNow();
  const [feed, book, stat, treasury, coins, money] = await Promise.all([
    launchFeed(now),
    playbook(now),
    chainStat().catch(() => null),
    readTreasury().catch(() => null),
    readPonsLatest(6).catch(() => []),
    claims(now),
  ]);
  const ethUsd = stat?.ethUsd ?? null;
  const latest = feed.launches[0] ?? null;
  const wall = feed.launches.slice(0, 13);
  const sample = feed.mode === "sample";
  const recent = money.claims.slice(-6).reverse();

  return (
    <main>
      <section className="hero" aria-label={BRAND.name}>
        <HeroScene />
        <div className="hero-in">
          <h1>{BRAND.name}</h1>
          <p className="sub">{BRAND.slogan}</p>
          <div className="hero-acts">
            <Link className="btn go" href="/round">
              Live round
            </Link>
            {hasX ? (
              <a className="btn" href={BRAND.x} target="_blank" rel="noreferrer">
                <XGlyph size={16} />
                {BRAND.xHandle}
              </a>
            ) : (
              <Link className="btn" href="/docs">
                How it works
              </Link>
            )}
          </div>
        </div>
        <a className="cue" href="#mission">
          Scroll
          <i />
        </a>
      </section>

      <section className="band" id="mission">
        <div className="wrap mission">
          <div>
            <div className="kicker">AI launch agent on {CHAIN.name}</div>
            <h2>Trending Topics, Turned Into Tokens</h2>
            <p className="lede">
              {BRAND.tagline} Fees are its whole income: <b>{pct}%</b> buys back {BRAND.symbol}, the other half funds the next launch.
            </p>
            <div className="facts">
              <div>
                <b>48</b>
                <span>rounds every day</span>
              </div>
              <div>
                <b>0</b>
                <span>launch tokens the dev keeps</span>
              </div>
              <div>
                <b>{pct}%</b>
                <span>of fees buy {BRAND.symbol}</span>
              </div>
            </div>
            <div className="ctas">
              <Link className="btn go big" href="/round">
                Follow the round
              </Link>
              <Link className="btn big" href="/docs">
                How it works
              </Link>
            </div>
            <div className="acts">
              <CaPill id="ca-hero" />
              {hasX ? (
                <a className="btn" href={BRAND.x} target="_blank" rel="noreferrer">
                  Launch posts on X
                </a>
              ) : null}
            </div>
          </div>
          <div className="wall" aria-label="Launch history">
            <div className="wall-h">
              <span className="t">
                <span className="blip" />
                Launch history
              </span>
              <span className="t">
                <span className="hide-sm">next round</span> <NextRound className="cd" />
              </span>
            </div>
            <div className="tiles">
              {wall.length ? (
                wall.map((l, i) => {
                  const mcap = mcapUsd(l, ethUsd);
                  return (
                    <Link key={l.id} className={`tile ${i === 0 ? "big" : ""}`} href={`/launches/${l.id}`} title={`${l.name} ($${l.symbol})`}>
                      <TokenArt symbol={l.symbol} logo={null} className={i === 0 ? "text-[44px]" : "text-[15px]"} />
                      {i === 0 ? <span className="chip lime newest">Newest</span> : null}
                      {l.lane === "breaking" ? (
                        <span className="chip brk lane">breaking</span>
                      ) : l.pair.symbol !== "ETH" ? (
                        <span className="chip stock lane">{l.pair.symbol}</span>
                      ) : null}
                      <span className="cap">
                        <b>${l.symbol}</b>
                        <span>{sample ? `≈${l.sampleFeesEth} ETH` : mcap ? usd(mcap) : stageText(l)}</span>
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className="empty" style={{ gridColumn: "1 / -1" }}>
                  Logos land here after the first launch.
                </div>
              )}
            </div>
            <div className="wall-f">
              <span>
                {feed.launches.length} launches {sample ? "(sample)" : "so far"}
              </span>
              <Link href="/launches">See every launch</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="pons-h">
        <div className="wrap">
          <BandHead kicker="On Pons right now" kickerColor="#ff9a5c" title="Coins Moving on Pons" id="pons-h">
            The newest launches on the Pons launchpad, read from its factory a minute ago. They are not {BRAND.name} tokens: this is the crowd every new one has
            to stand out in.
          </BandHead>
          <PonsBoard coins={coins} now={now} ethUsd={ethUsd} />
        </div>
      </section>

      <section className="band alt" aria-labelledby="latest-h">
        <div className="wrap">
          <BandHead
            kicker="Latest launches"
            title={`The Newest ${BRAND.name} Tokens`}
            id="latest-h"
            aside={
              <Link className="more" href="/launches">
                All launches
              </Link>
            }
          />
          {latest ? (
            <div className="panel spot" data-testid="spotlight">
              <TokenArt symbol={latest.symbol} />
              <div style={{ minWidth: 0 }}>
                <div className="faint mono" style={{ fontSize: 12.5 }}>
                  Launch {launchNo(latest)} · {ago(latest.launchedAt, now)} ago · {laneText(latest).toLowerCase()}
                  {sample ? " · sample" : ""}
                </div>
                <div className="nm" style={{ marginTop: 8 }}>
                  {latest.name}
                  <span>${latest.symbol}</span>
                </div>
                <p className="why">{latest.description}</p>
                <div className="kv">
                  <div>
                    <div className="k">Market cap</div>
                    <div className="v">{sample ? "–" : usd(mcapUsd(latest, ethUsd))}</div>
                  </div>
                  <div>
                    <div className="k">Stage</div>
                    <div className="v">{stageText(latest)}</div>
                  </div>
                  <div>
                    <div className="k">Fees earned</div>
                    <div className="v">{sample ? `≈${latest.sampleFeesEth}` : "–"}</div>
                  </div>
                  <div>
                    <div className="k">Pair</div>
                    <div className="v">{latest.pair.symbol}</div>
                  </div>
                  <div>
                    <div className="k">Dev holds</div>
                    <div className="v">{devHoldsText(latest).text}</div>
                  </div>
                </div>
                <Link className="more" style={{ display: "inline-block", marginTop: 16 }} href={`/launches/${latest.id}`}>
                  Read how the agent made it →
                </Link>
                <div className="addr-line">
                  <span className="faint">CA</span>
                  {latest.address ? (
                    <>
                      <code>{latest.address}</code>
                      <CopyText value={latest.address} label={`$${latest.symbol} address`} />
                    </>
                  ) : (
                    <code>no address: sample launch</code>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="panel spot">
              <div className="empty">The first launch shows up here.</div>
            </div>
          )}
          <div style={{ marginTop: 20 }}>
            <LaunchTable launches={feed.launches} ethUsd={ethUsd} now={now} limit={6} />
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="money-h">
        <div className="wrap">
          <BandHead kicker="The money" title={`How ${BRAND.name} Gets Paid`} id="money-h">
            Not one coin it launches stays with it. The only money it makes is the creator slice of trading fees, and the split below sits in a contract with no
            owner, so the agent cannot touch it.
          </BandHead>
          <div className="money">
            <SplitPanel state={treasury} ethUsd={ethUsd} />
            <div className="panel pad">
              <div className="band-h" style={{ marginBottom: 6 }}>
                <h3>Claims and buybacks</h3>
                <span className="faint mono" style={{ fontSize: 12 }}>
                  {money.mode === "sample" ? "sample figures" : `${money.claims.length} claims`}
                </span>
              </div>
              <ul className="bb">
                {!buybackLive() ? (
                  <li className="empty" style={{ display: "block" }}>
                    No buybacks yet. They begin once {BRAND.symbol} trades, starting with everything saved until then.
                  </li>
                ) : null}
                {recent.map((c) => (
                  <li key={c.at}>
                    <span>
                      <span className="amt">{eth(c.ethWei)} ETH</span>
                      <span className="faint"> claimed</span>
                    </span>
                    <span className="meta">
                      {eth(c.toBuybackWei)} to buyback · {eth(c.toBudgetWei)} to launches
                      <br />
                      {ago(c.at, now)} ago
                      {c.tx ? (
                        <>
                          {" · "}
                          <a href={`${CHAIN.explorer}/tx/${c.tx}`} target="_blank" rel="noreferrer">
                            tx
                          </a>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              <Link className="more" style={{ display: "inline-block", marginTop: 12 }} href="/earnings">
                Earnings and the treasury
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="band alt" aria-labelledby="loop-h">
        <div className="wrap">
          <BandHead
            kicker="The loop"
            title="The Fee Loop"
            id="loop-h"
            aside={
              <Link className="more" href="/docs">
                See the docs
              </Link>
            }
          />
          <ol className="flow">
            <li>
              <h3>A topic catches fire</h3>
              <p>Every 30 minutes the agent reads X for posts spreading faster than usual.</p>
            </li>
            <li>
              <h3>A skeptical trader votes</h3>
              <p>Only a topic rated 8/10 or better as a buy gets a name and a logo.</p>
            </li>
            <li>
              <h3>One token on Pons</h3>
              <p>Sent through the {BRAND.name} launcher with ETH or a fitting stock pair. No opening buy, so the dev holds 0.</p>
            </li>
            <li>
              <h3>Trades pay a fee</h3>
              <p>Each buy and sell sends a creator slice to the treasury.</p>
            </li>
            <li>
              <h3>The fee splits in two</h3>
              <p>
                {pct}% buys {BRAND.symbol} and burns it. The rest funds the next launch.
              </p>
            </li>
          </ol>
          <div className="loopline">
            ↻ 05 loops back into 01: <b>each burned {BRAND.symbol} is paid for by the launches before it</b>
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="learn-h">
        <div className="wrap">
          <BandHead
            kicker="Learning loop"
            title="What the Playbook Learned"
            id="learn-h"
            aside={
              <Link className="more" href="/playbook">
                Full playbook
              </Link>
            }
          >
            After each round it sets the results of earlier launches side by side and edits a rule only where the numbers agree.
            {book.mode === "sample" ? " The entries below are examples until the agent runs." : ""}
          </BandHead>
          <ul className="feed">
            {book.log.slice(0, 4).map((e) => (
              <li key={e.at}>
                <time>{ago(e.at, now)} ago</time>
                <div>
                  <b>{e.title}</b>
                  <p className="why">
                    {e.change} {e.reason}
                  </p>
                  <div className="ev">{e.evidence}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
