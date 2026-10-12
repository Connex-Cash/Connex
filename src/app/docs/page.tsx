import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { PairsTable } from "@/components/connex/Pairs";
import { BRAND, CHAIN } from "@/config/brand";
import { DEPLOY_DEFAULTS } from "@/config/contracts";
import { FAQ } from "@/lib/faq";
import { readPairs } from "@/lib/onchain/read";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const revalidate = 600;

export const metadata: Metadata = pageMeta({
  title: "How it works",
  description: `How ${BRAND.name} works, start to finish: the 30-minute round, the trader check, naming, pairs, launching on Pons, the fee split, the playbook and the safety rules.`,
  path: "/docs",
  type: "article",
});

const TOC = [
  ["what", "In one paragraph"],
  ["clock", "The half-hour clock"],
  ["trend", "Reading the trend"],
  ["check", "The skeptical trader"],
  ["name", "Name, story and logo"],
  ["pair", "Picking a pair"],
  ["launch", "Going live on Pons"],
  ["breaking", "Breaking rounds"],
  ["money", "Fees, buybacks and the budget"],
  ["learn", "How the playbook learns"],
  ["safety", "Safety rules"],
  ["gauge", "The treasury gauge"],
  ["parts", "What runs where"],
  ["check-it", "Verify it"],
  ["words", "Glossary"],
  ["faq", "Questions"],
] as const;

const d = DEPLOY_DEFAULTS;

export default async function DocsPage() {
  const pairs = await readPairs().catch(() => []);
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  const article = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: `How ${BRAND.name} works`,
    about: `${BRAND.category} on ${CHAIN.name}`,
    url: `${BRAND.url}/docs`,
    publisher: { "@id": `${BRAND.url}/#org` },
  };
  return (
    <main>
      <JsonLd data={[breadcrumbs([{ name: "How it works", path: "/docs" }]), faqLd, article]} />
      <section className="band first">
        <div className="wrap">
          <div className="docs-h">
            <h1 className="title">How {BRAND.name} Works</h1>
            <p>
              The agent&apos;s whole routine in the order it runs, and which parts are held by a contract instead of a promise. Every step also shows up live on
              the current round page, and each launch keeps its own log.
            </p>
          </div>
          <div className="docs">
            <nav className="toc" aria-label="Docs sections">
              <span className="label">On this page</span>
              {TOC.map(([id, label]) => (
                <a key={id} href={`#${id}`}>
                  {label}
                </a>
              ))}
            </nav>
            <article className="doc pad">
              <section id="what">
                <h3>In one paragraph</h3>
                <p>
                  {BRAND.name} is an autonomous launch agent for memecoins on {CHAIN.name}. It watches what people are talking about on X, decides whether any
                  of it would make a token that traders actually want, and if so launches that token on Pons, the launchpad of {CHAIN.name}. It does this on a
                  fixed clock, every half hour, without a human picking topics.
                </p>
                <p>
                  Not one unit of its launches stays with the agent. Its income is the creator share of trading fees, which goes to a treasury contract that
                  splits them {d.buybackShareBps / 100}/{100 - d.buybackShareBps / 100}: one half buys back {BRAND.symbol} and burns it, the other half pays for
                  the next launches.
                </p>
              </section>
              <section id="clock">
                <h3>The half-hour clock</h3>
                <p>
                  Rounds start at :00 and :30 UTC, which makes 48 rounds a day. A round is a fixed sequence of nine steps, each with its own time budget. Most
                  rounds finish within ten minutes; if a step overruns, the round keeps going and notes the overrun. A round may also end early with no launch
                  at all.
                </p>
                <ol className="timeline">
                  <li>
                    <span className="num">1</span>
                    <div>
                      <b>Read the trend</b>. Find the posts spreading fastest on X right now, with the crypto news wire always included (up to 12 min).
                    </div>
                  </li>
                  <li>
                    <span className="num">2</span>
                    <div>
                      <b>Trader check</b>. A skeptical trader model rates every candidate as a buy. Only 8/10 or better moves on; otherwise it searches again (4
                      min).
                    </div>
                  </li>
                  <li>
                    <span className="num">3</span>
                    <div>
                      <b>Name</b>. A name, a ticker and a short story written for memecoin traders (4 min).
                    </div>
                  </li>
                  <li>
                    <span className="num">4</span>
                    <div>
                      <b>Draw</b>. A fresh logo, drawn only for a topic that passed the check (6 min).
                    </div>
                  </li>
                  <li>
                    <span className="num">5</span>
                    <div>
                      <b>Pick the pair</b>. ETH, or a stock token from Robinhood when that company is the joke (1 min).
                    </div>
                  </li>
                  <li>
                    <span className="num">6</span>
                    <div>
                      <b>Launch</b>. The token goes out on Pons through the launcher contract (4 min).
                    </div>
                  </li>
                  <li>
                    <span className="num">7</span>
                    <div>
                      <b>Announce</b>. An X post carrying the logo, the name and the contract address, when posting is switched on.
                    </div>
                  </li>
                  <li>
                    <span className="num">8</span>
                    <div>
                      <b>Collect</b>. Creator fees are swept into the treasury and split; this also runs every five minutes between rounds.
                    </div>
                  </li>
                  <li>
                    <span className="num">9</span>
                    <div>
                      <b>Review</b>. Every launch&apos;s numbers are refreshed and the playbook is edited where the data supports it.
                    </div>
                  </li>
                </ol>
              </section>
              <section id="trend">
                <h3>Reading the trend</h3>
                <p>
                  The agent runs several searches on X for posts younger than two hours and ranks them by how fast they are spreading: engagement divided by
                  age, so a post taking off right now beats a bigger one that peaked this morning. The crypto news wire is always read too. The exact searches
                  live in the playbook, which lets the agent shift its attention as it learns.
                </p>
                <p>
                  From that evidence a model proposes a handful of candidate topics. Each is rated on four 0 to 10 scales: momentum, memeability, originality
                  and trader appeal.
                </p>
              </section>
              <section id="check">
                <h3>The skeptical trader</h3>
                <p>
                  Ahead of any naming or drawing, a separate model plays a doubtful memecoin trader and answers one question about each candidate: would you
                  actually buy this, right now? Anything under 8 out of 10 is out, however funny it is. If nothing passes, the agent may try another search, and
                  if still nothing passes, the round launches nothing and records why.
                </p>
                <p>
                  Among the topics that pass, the weighted score decides. The starting weights are momentum 35%, memeability 30%, originality 20% and trader
                  appeal 15%; the playbook adjusts them over time. The current round page shows the full ranking, including the topics turned down.
                </p>
              </section>
              <section id="name">
                <h3>Name, story and logo</h3>
                <p>
                  The naming model works inside hard limits, in the house style the playbook describes: 32 characters for the name, between two and ten letters
                  or digits for the ticker, 280 characters for the story. Anything outside those limits goes back to the model along with the rule it broke.
                  Then an image model draws a fresh logo for the topic: no real faces, no brand logos, no text. The site keeps the image, and its address goes
                  into the token&apos;s metadata at launch.
                </p>
              </section>
              <section id="pair">
                <h3>Picking a pair</h3>
                <p>
                  On Pons, a token is quoted in a single asset picked at launch. ETH is the default. Pons also accepts USDG and a list of Robinhood stock
                  tokens, which it records on chain; the agent may pair a launch with a stock only when the company is plainly the joke, so that a trader gets
                  it at a glance.
                </p>
                <p>
                  Stock tokens are recognised by contract address, not by ticker. Many unrelated tokens on {CHAIN.name} reuse famous tickers; the official ones
                  are proxies to Robinhood&apos;s token beacon and their names end in &ldquo;• Robinhood Token&rdquo;. The table below is read from the Pons
                  contract right now.
                </p>
                <PairsTable pairs={pairs} />
              </section>
              <section id="launch">
                <h3>Going live on Pons</h3>
                <p>
                  The agent launches through the {BRAND.name} launcher contract, never directly. The launcher creates the token on the Pons factory with the
                  treasury as the creator fee recipient, zero extra creator tax and Pons&apos; own buyback route turned off, and it pays Pons its launch charge
                  and nothing more. There is no opening buy, so the whole supply starts on the bonding curve. This is what &quot;dev holds zero&quot;
                  means: it holds for every token the agent launches. {BRAND.symbol} is launched separately, and its team holding is listed on the{" "}
                  <Link href="/token">Token</Link> page.
                </p>
                <p>
                  On Pons a new token is priced by a bonding curve: each purchase nudges the price up. Once every curve token is bought, the market shifts into
                  a Uniswap pool and its liquidity is locked. Only the agent&apos;s wallet may call the launcher, and at most one launch every{" "}
                  {d.launcherMinIntervalSec / 60} minutes, so even a stolen key could not spray launches or drain the budget quickly.
                </p>
              </section>
              <section id="breaking">
                <h3>Breaking rounds</h3>
                <p>
                  Between the fixed rounds, the agent rechecks X at short intervals, looking for new posts that are gaining replies and reposts far quicker than
                  the rest. When one clearly breaks out, it runs the whole nine-step routine straight away, with the same trader check, the same naming rules
                  and the same limits, so a story can become a token right away rather than waiting for the clock.
                </p>
                <p>
                  A breaking launch still goes through the launcher contract, so the minimum gap of {d.launcherMinIntervalSec / 60} minutes between two launches
                  applies to it as well. These launches carry a <b>breaking</b> tag in every list.
                </p>
              </section>
              <section id="money">
                <h3>Fees, buybacks and the budget</h3>
                <p>
                  Each trade on Pons carries a fee, and Pons forwards a share of it to the creator. For {BRAND.name} launches that is the treasury. Fees build
                  up in Pons&apos; fee escrow; anyone can call the treasury to sweep and collect them, and the money can only go to the treasury.
                </p>
                <ul>
                  <li>
                    <b>Buyback side ({d.buybackShareBps / 100}%).</b> Saved to buy {BRAND.symbol} and send it to the burn address. Until {BRAND.symbol} exists,
                    it is kept and cannot be spent on anything else.
                  </li>
                  <li>
                    <b>Launch side ({100 - d.buybackShareBps / 100}%).</b> Pays the Pons launch fee for each new token and a fixed{" "}
                    {Number(d.opsAllowanceWei) / 1e18} ETH per launch to the agent&apos;s wallet for gas and tools. Above {Number(d.budgetCeilingWei) / 1e18}{" "}
                    ETH, the overflow joins the buyback side.
                  </li>
                </ul>
                <p>
                  Buybacks are deliberately small and spaced: at most {Number(d.maxBuybackPerCallWei) / 1e18} ETH each, at least{" "}
                  {d.minBuybackIntervalSec / 3600} hour apart, each with a minimum amount of {BRAND.symbol} the agent quotes just before. A buy that anyone
                  could trigger with any price limit would be easy prey for sandwich bots, because neither the Pons curve nor its pool carries a price oracle to
                  check against. If the agent stops for {d.fallbackAfterSec / 86400} days, anyone may run the same small buyback so the reserve never gets
                  stranded.
                </p>
                <p>
                  Launches paired with a stock earn their fees in that stock. The treasury splits those the same way and the agent swaps each half to ETH on
                  Uniswap, keeping each half on its own side. Pool fees after graduation are often taken in the memecoin itself; only Pons&apos; own operator
                  may convert those, so they reach the treasury when Pons sweeps them.
                </p>
              </section>
              <section id="learn">
                <h3>How the playbook learns</h3>
                <p>
                  Each launch is measured an hour, a day and a week after it goes out: market cap, trading volume, graduation, and what it paid its creator.
                  Each round the agent groups those results by topic type, pair, name length and launch hour, and a model suggests edits and has to justify each
                  one with figures. Code then rejects any edit outside fixed bounds and logs every one on the <Link href="/playbook">playbook page</Link>.
                  Learning starts only after several launches have traded for sixty minutes or more.
                </p>
              </section>
              <section id="safety">
                <h3>Safety rules</h3>
                <p>These are hard-coded apart from the playbook; the learning loop cannot reach them.</p>
                <ul>
                  <li>Never sends, buys or holds launched tokens; the contracts cannot do it either.</li>
                  <li>Skips private people, minors, deaths, disasters, hate, sexual and violent themes, and repeats.</li>
                  <li>Never uses its own name, a name or ticker it used before, real brands or real people.</li>
                  <li>Two filters on every topic and name: a static blocklist, followed by an independent model that judges against the rules.</li>
                  <li>Paid models must stay under a price ceiling, paid calls under an hourly ceiling, and every round under a spending cap.</li>
                </ul>
              </section>
              <section id="gauge">
                <h3>The treasury gauge</h3>
                <p>
                  The figure under the navigation bar on every page is the treasury&apos;s value in dollars: ETH held for buybacks, ETH held for launches, ETH
                  not yet split and fees waiting in the Pons escrow, priced at the current ETH rate. Nothing else counts. Until the treasury is deployed it
                  reads $0 and says so.
                </p>
                <p>
                  The marks along the bar sit at $10K, $50K, $100K, $250K, $500K, <b>$1M</b>, $2.5M, $5M and $10M; each one lights up once the treasury passes
                  it.
                </p>
              </section>
              <section id="parts">
                <h3>What runs where</h3>
                <ul>
                  <li>
                    <b>Contracts on {CHAIN.name}:</b> the launcher, the treasury and, once {BRAND.symbol} exists, the buyback contract. No owner, no admin, no
                    upgrade. See <Link href="/contracts">Contracts</Link>.
                  </li>
                  <li>
                    <b>The agent:</b> a keeper process on a server, holding the hot wallet that signs launches. It calls X, a language model and an image model,
                    all paid services, and writes its log for this site to read.
                  </li>
                  <li>
                    <b>This site:</b> reads the chain, Pons and the agent&apos;s log. It cannot launch, move funds or change a rule.
                  </li>
                </ul>
              </section>
              <section id="check-it">
                <h3>Verify it</h3>
                <ul>
                  <li>Every launch links to its token and its launch transaction on Blockscout.</li>
                  <li>The Dev holds column reads the launcher&apos;s, the treasury&apos;s and the agent wallet&apos;s balance of each token.</li>
                  <li>The treasury&apos;s balances and totals are public views on the contract.</li>
                  <li>Each launch commits a hash of the evidence and of the playbook version it used, so the log cannot be rewritten afterwards.</li>
                </ul>
              </section>
              <section id="words">
                <h3>Glossary</h3>
                <dl className="gloss">
                  <dt>Pons</dt>
                  <dd>The launchpad for new tokens on {CHAIN.name}.</dd>
                  <dt>Pair</dt>
                  <dd>What a token is quoted in: ETH, USDG or an approved stock token.</dd>
                  <dt>Creator fees</dt>
                  <dd>The creator&apos;s cut of every trading fee on Pons.</dd>
                  <dt>Bonding curve</dt>
                  <dd>The opening market of a Pons token, where price rises with every buy.</dd>
                  <dt>Graduation</dt>
                  <dd>The curve is bought out and trading continues in a Uniswap pool whose liquidity is locked.</dd>
                  <dt>Buyback</dt>
                  <dd>Spending fees on {BRAND.symbol} and burning what was bought.</dd>
                  <dt>Sample</dt>
                  <dd>Invented data shown until the agent and contracts are live, always tagged.</dd>
                </dl>
              </section>
              <section id="faq">
                <h3>Questions</h3>
                <div className="qa">
                  {FAQ.map((f) => (
                    <details key={f.q}>
                      <summary>{f.q}</summary>
                      <p>{f.a}</p>
                    </details>
                  ))}
                </div>
              </section>
              <p className="faint" style={{ marginTop: 28 }}>
                {BRAND.name} is an experiment. Every token it puts out is a memecoin that promises nothing and may end up worth nothing. This page is not
                financial advice.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
