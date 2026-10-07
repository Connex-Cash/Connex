import Link from "next/link";
import { requestNow } from "@/lib/now";
import { CopyCaInline } from "@/components/CopyCa";
import { LaunchTable } from "@/components/connex/LaunchTable";
import { PairsTable } from "@/components/connex/Pairs";
import { PonsBoard } from "@/components/connex/PonsBoard";
import { RoundHeader, StepList } from "@/components/connex/RoundView";
import { FeeSplit, SampleBanner, TreasuryPanel } from "@/components/connex/Treasury";
import { Mark } from "@/components/Mark";
import { NextRound } from "@/components/site/StatusStrip";
import { ChainTag, SampleTag } from "@/components/ui";
import { BRAND, CHAIN } from "@/config/brand";
import { DEPLOY_DEFAULTS, launchesLive } from "@/config/contracts";
import { currentRound, launchFeed, playbook } from "@/lib/agent/data";
import { STEP_INFO, STEP_KEYS } from "@/lib/agent/types";
import { chainStat } from "@/lib/chainstat";
import { FAQ } from "@/lib/faq";
import { ago } from "@/lib/format";
import { readPairs, readPonsLatest, readTreasury } from "@/lib/onchain/read";

export const revalidate = 30;

export default async function Home() {
  const now = requestNow();
  const [round, feed, book, stat, pairs, treasury, coins] = await Promise.all([
    currentRound(now),
    launchFeed(now),
    playbook(now),
    chainStat().catch(() => null),
    readPairs().catch(() => []),
    readTreasury().catch(() => null),
    readPonsLatest(10).catch(() => []),
  ]);
  const stocks = pairs.filter((p) => p.kind === "stock" && p.approved);

  return (
    <main>
      {/* Hero */}
      <section className="border-b-2 border-ink">
        <div className="wrap grid grid-cols-1 gap-10 py-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:py-16">
          <div className="grid content-start gap-6">
            <p className="m-0 flex items-center gap-2 font-mono text-[12.5px] text-ink-2">
              <Mark size={16} /> AI launch agent on {CHAIN.name}
            </p>
            <h1 className="m-0 text-[clamp(52px,8.4vw,112px)] leading-[0.86] tracking-[-0.03em] [font-stretch:125%]">{BRAND.name}</h1>
            <p className="m-0 font-display text-[clamp(24px,3.4vw,36px)] leading-[1.1] font-extrabold [font-stretch:110%]">
              AI Launches.
              <br />
              Trends Convert.
              <br />
              <span className="text-signal-ink">Dev Holds Zero.</span>
            </p>
            <p className="lede m-0">{BRAND.tagline}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/round" className="btn btn-ink">
                Watch the current round
              </Link>
              <Link href="/docs" className="btn">
                How it works
              </Link>
            </div>
            <CopyCaInline />
          </div>
          <aside className="panel grid content-start gap-4 p-5" aria-label="Current round">
            <RoundHeader round={round} />
            <StepList round={round} compact />
            <Link href="/round" className="tlink text-[14px]">
              Read every step of this round
            </Link>
          </aside>
        </div>
      </section>

      {/* Rules strip */}
      <section aria-label="The three rules" className="border-b border-line">
        <div className="wrap">
        <dl className="m-0 grid grid-cols-1 sm:grid-cols-3">
          {[
            ["48", "rounds a day, one every 30 minutes"],
            ["0", "tokens kept by the dev, checked per launch"],
            [`${DEPLOY_DEFAULTS.buybackShareBps / 100} / ${100 - DEPLOY_DEFAULTS.buybackShareBps / 100}`, `fees split: ${BRAND.symbol} buyback / next launch`],
          ].map(([k, v]) => (
            <div key={v} className="border-line py-6 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0">
              <dt className="font-display text-[44px] leading-none font-extrabold [font-stretch:120%]">{k}</dt>
              <dd className="m-0 mt-2 text-[14px] text-ink-2">{v}</dd>
            </div>
          ))}
        </dl>
        </div>
      </section>

      {/* Latest launches */}
      <section className="sec" aria-labelledby="latest-h">
        <div className="wrap grid gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="sec-h !mb-0">
              <h2 id="latest-h">Every trend it launched, newest first</h2>
              <p>
                One row per token: what it is called, what it trades against, when it went out and whether anyone on the dev side holds a single unit of it.
              </p>
            </div>
            <Link href="/launches" className="btn btn-sm">
              All launches
            </Link>
          </div>
          {feed.mode === "sample" ? (
            <SampleBanner>
              These launches are samples. The launcher contract is not deployed yet, so no CONNEX token exists. Real launches replace this list the moment the
              contract records the first one.
            </SampleBanner>
          ) : (
            <p className="m-0 flex items-center gap-2 text-[13px] text-ink-2">
              <ChainTag /> Read from the launcher contract and Pons.
            </p>
          )}
          <LaunchTable launches={feed.launches} ethUsd={stat?.ethUsd ?? null} now={now} limit={8} />
        </div>
      </section>

      {/* One round */}
      <section className="sec" aria-labelledby="round-h">
        <div className="wrap grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="sec-h">
            <h2 id="round-h">How one round turns a trending topic into a token</h2>
            <p>
              The clock decides when, the agent decides what. At :00 and :30 UTC a new round opens, and every step runs against its own stopwatch, so one slow model cannot
              hold up the day. Most rounds finish in about eight minutes. The next one opens in <NextRound className="font-semibold text-ink" />.
            </p>
            <p>
              A round is allowed to end with nothing. If no topic reaches 8 out of 10 with the skeptical trader, the agent writes down why and waits for the
              next half hour. Filling the slot with a weak coin would only teach the playbook the wrong lesson.
            </p>
          </div>
          <ol className="steps">
            {STEP_KEYS.map((k, i) => (
              <li key={k}>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{STEP_INFO[k].title}</h3>
                  <p>{STEP_INFO[k].plain}</p>
                </div>
                <span className="t">≤ {STEP_INFO[k].budgetMin} min</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Dev holds zero */}
      <section className="sec" aria-labelledby="zero-h">
        <div className="wrap grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div className="sec-h">
            <h2 id="zero-h">Dev holds zero, and the chain lets you check it</h2>
            <p>
              Plenty of launchers promise the dev holds nothing. {BRAND.name} moves that promise into code that anyone can read on Blockscout, then shows the
              balance next to every token so you do not have to take the site&apos;s word for it either.
            </p>
          </div>
          <div className="grid gap-5">
            <div>
              <h3 className="m-0 mb-2 text-[19px]">What the contracts guarantee</h3>
              <ul className="m-0 grid gap-2 pl-5 text-[15px]">
                <li>The launcher pays Pons its launch charge and nothing more: no opening buy, so the full supply starts on the bonding curve.</li>
                <li>The launcher and the treasury have no function that buys, transfers or approves a launched token. Anything sent to them can only be burned.</li>
                <li>Every launch names the treasury as its Pons fee recipient, with zero extra creator tax and Pons&apos; own buyback route switched off.</li>
              </ul>
            </div>
            <div>
              <h3 className="m-0 mb-2 text-[19px]">What they cannot guarantee</h3>
              <p className="m-0 text-[15px] text-ink-2">
                The agent signs launches from an ordinary hot wallet, and no contract can stop an ordinary wallet from buying on the open market. So the site
                reads that wallet&apos;s balance of every launch, together with the launcher&apos;s and the treasury&apos;s, and prints the sum in the Dev holds column.
                A number other than zero would show up there in red.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Money */}
      <section className="sec" aria-labelledby="money-h">
        <div className="wrap grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="grid content-start gap-6">
            <div className="sec-h !mb-0">
              <h2 id="money-h">Where the creator fees end up</h2>
              <p>
                Pons skims a small fee from each trade and passes a slice of it to whoever created the token. For every {BRAND.name} launch the creator is
                the treasury contract, and that share is the only money the agent ever earns.
              </p>
            </div>
            <FeeSplit />
            <p className="m-0 text-[15px]">
              The buyback half buys {BRAND.symbol} on the market and sends it to the burn address. Until {BRAND.symbol} exists, that half is simply saved: the
              contract cannot spend it on launches or anything else, so the very first buyback starts with everything collected so far. The launch half pays
              the Pons launch fee for each new token plus a fixed {Number(DEPLOY_DEFAULTS.opsAllowanceWei) / 1e18} ETH towards the agent&apos;s gas and tools.
              If it ever holds more than {Number(DEPLOY_DEFAULTS.budgetCeilingWei) / 1e18} ETH, the rest rolls over to the buyback side.
            </p>
            <p className="m-0 text-[15px] text-ink-2">
              Buybacks come in small, spaced pieces: at most {Number(DEPLOY_DEFAULTS.maxBuybackPerCallWei) / 1e18} ETH at a time and no more than once an
              hour, with a minimum price the agent checks first. A buy anyone could trigger with any price limit would be an open invitation to sandwich
              bots. If the agent ever goes quiet for a week, anyone may run the same small buyback, so the saved ETH can never get stuck.
            </p>
            <Link href="/earnings" className="tlink text-[14px]">
              Earnings, treasury and every split
            </Link>
          </div>
          <TreasuryPanel state={treasury} ethUsd={stat?.ethUsd ?? null} />
        </div>
      </section>

      {/* Pairs */}
      <section className="sec" aria-labelledby="pairs-h">
        <div className="wrap grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="sec-h">
            <h2 id="pairs-h">ETH by default, a stock token when the company is the joke</h2>
            <p>
              On Pons, the quote asset of a token is picked once, at launch, and never changes. Pons keeps its own list of accepted pairs on chain; the table is read from that list
              right now{stocks.length ? `, and it currently includes ${stocks.length} Robinhood stock tokens` : ""}.
            </p>
            <p>
              The agent picks a stock only when a trader would get the pairing at a glance: a joke about graphics chips against NVDA, not a cat video against
              anything. Stock tokens are matched by contract address, never by ticker, because the chain is full of lookalike tokens borrowing famous tickers.
              Fees from a stock-paired launch arrive in that stock; the treasury splits them the same way and swaps each half to ETH on its own side.
            </p>
          </div>
          <PairsTable pairs={pairs} />
        </div>
      </section>

      {/* Playbook */}
      <section className="sec" aria-labelledby="book-h">
        <div className="wrap grid gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="sec-h !mb-0">
              <h2 id="book-h">The playbook rewrites itself from results</h2>
              <p>
                The agent keeps a short playbook: scoring weights, naming rules, the image style and where it searches. After every round it lines up the results of past
                launches and edits only what the data backs, writing down the change, the reason and the evidence.
              </p>
            </div>
            <Link href="/playbook" className="btn btn-sm">
              Full playbook
            </Link>
          </div>
          {book.mode === "sample" ? <SampleBanner>The agent is not running yet, so these entries are examples of what it records.</SampleBanner> : null}
          <ol className="steps">
            {book.log.slice(0, 3).map((e) => (
              <li key={e.at}>
                <span className="n">{ago(e.at, now)}</span>
                <div>
                  <h3>{e.title}</h3>
                  <p>{e.change}</p>
                  <p className="mt-1 font-mono text-[12.5px] text-ink-4">{e.evidence}</p>
                </div>
                <span className="t">{book.mode === "sample" ? <SampleTag /> : `v${book.version}`}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pons market */}
      <section className="sec" aria-labelledby="pons-h">
        <div className="wrap grid gap-6">
          <div className="sec-h !mb-0">
            <h2 id="pons-h">The market every launch walks into</h2>
            <p>
              {BRAND.name} launches on Pons, the launchpad of {CHAIN.name}: a new token starts life on a bonding curve, then shifts into a Uniswap pool, liquidity locked, after
              the curve is bought out. These are the launches trading there right now.
            </p>
          </div>
          <PonsBoard coins={coins} now={now} ethUsd={stat?.ethUsd ?? null} />
        </div>
      </section>

      {/* FAQ */}
      <section className="sec" aria-labelledby="faq-h">
        <div className="wrap grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <div className="sec-h">
            <h2 id="faq-h">Questions people ask about {BRAND.name}</h2>
            <p>
              Short answers here, the long ones in the <Link href="/docs" className="tlink">docs</Link>.
            </p>
          </div>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="wrap grid gap-5 py-16">
        <h2 className="m-0 max-w-[18ch] text-[clamp(30px,5vw,52px)]">The next trend converts in <NextRound className="font-display" />.</h2>
        <p className="lede m-0">
          Follow the round as it happens, or read how the contracts keep the dev at zero. {launchesLive() ? "" : "Everything you see is a sample until the contracts are deployed."}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/round" className="btn btn-signal">
            Open the current round
          </Link>
          <Link href="/contracts" className="btn">
            Read the contracts
          </Link>
        </div>
      </section>
    </main>
  );
}
