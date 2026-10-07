import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { BRAND, CHAIN } from "@/config/brand";
import { DEPLOY_DEFAULTS } from "@/config/contracts";
import { FAQ } from "@/lib/faq";
import { breadcrumbs, pageMeta } from "@/lib/seo";

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
  ["money", "Fees, buybacks and the budget"],
  ["learn", "How the playbook learns"],
  ["safety", "Safety rules"],
  ["parts", "What runs where"],
  ["check-it", "Verify it"],
  ["words", "Words used on this site"],
  ["faq", "Questions"],
] as const;

const d = DEPLOY_DEFAULTS;

export default function DocsPage() {
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
    <main className="wrap">
      <JsonLd data={[breadcrumbs([{ name: "How it works", path: "/docs" }]), faqLd, article]} />
      <div className="page-h">
        <h1>How {BRAND.name} works</h1>
        <p>The agent&apos;s whole routine, step after step, and which part of it is enforced by a contract rather than by good intentions.</p>
      </div>
      <div className="grid grid-cols-1 gap-12 pt-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Contents" className="lg:sticky lg:top-[110px] lg:self-start">
          <p className="m-0 mb-2 font-mono text-[11px] tracking-[0.08em] text-ink-4 uppercase">Contents</p>
          <ul className="m-0 grid list-none gap-1.5 p-0 text-[14px]">
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="tlink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <article className="doc">
          <h2 id="what" className="!mt-0">
            In one paragraph
          </h2>
          <p>
            {BRAND.name} is an autonomous launch agent for memecoins on {CHAIN.name}. It watches what people are talking about on X, decides whether any of it
            would make a token that traders actually want, and if so launches that token on Pons, the launchpad of {CHAIN.name}. It does this on a fixed
            clock, every half hour, without a human picking topics.
          </p>
          <p>
            Not one unit of its launches stays with the agent. Its income is the creator share of trading fees, which goes to a treasury contract that
            splits them {d.buybackShareBps / 100}/{100 - d.buybackShareBps / 100}: one half buys back {BRAND.symbol} and burns it, the other half pays for the
            next launches.
          </p>

          <h2 id="clock">The half-hour clock</h2>
          <p>
            Rounds start at :00 and :30 UTC, which makes 48 rounds a day. A round is a fixed sequence of nine steps, each with its own time budget. Most rounds
            finish within ten minutes; if a step overruns, the round keeps going and notes the overrun. A round may also end early with no launch at all.
          </p>
          <ol>
            <li>Read the trend (up to 12 minutes).</li>
            <li>Skeptical trader check (4 minutes).</li>
            <li>Name, ticker and story (4 minutes).</li>
            <li>Draw the logo (6 minutes).</li>
            <li>Choose the pair (1 minute).</li>
            <li>Launch on Pons (4 minutes).</li>
            <li>Announce on X, when posting is switched on.</li>
            <li>Collect and split fees. Fees are also collected every five minutes between rounds.</li>
            <li>Review results and rewrite the playbook.</li>
          </ol>

          <h2 id="trend">Reading the trend</h2>
          <p>
            The agent runs several searches on X for posts younger than two hours and ranks them by how fast they are spreading: engagement divided by age,
            so a post taking off right now beats a bigger one that peaked this morning. The crypto news wire is always read too. The exact searches live in
            the playbook, which lets the agent shift its attention as it learns.
          </p>
          <p>
            From that evidence a model proposes a handful of candidate topics. Each is rated on four 0 to 10 scales: momentum, memeability, originality and
            trader appeal.
          </p>

          <h2 id="check">The skeptical trader</h2>
          <p>
            Ahead of any naming or drawing, a separate model plays a doubtful memecoin trader and answers one question about each candidate: would you
            actually buy this, right now? Anything under 8 out of 10 is out, however funny it is. If nothing passes, the agent may try another search, and if
            still nothing passes, the round launches nothing and records why.
          </p>
          <p>
            Among the topics that pass, the weighted score decides. The starting weights are momentum 35%, memeability 30%, originality 20% and trader appeal
            15%; the playbook adjusts them over time. The current round page shows the full ranking, including the topics turned down.
          </p>

          <h2 id="name">Name, story and logo</h2>
          <p>
            The naming model works inside hard limits, in the house style the playbook describes: 32 characters for the name, between two and ten
            letters or digits for the ticker, 280 characters for the story. Anything outside those limits goes back to the model along with the rule it
            broke. Then an image model draws a fresh logo for the topic: no real faces, no brand logos, no text. The site keeps the image, and its address
            goes into the token&apos;s metadata at launch.
          </p>

          <h2 id="pair">Picking a pair</h2>
          <p>
            On Pons, a token is quoted in a single asset picked at launch. ETH is the default. Pons also accepts USDG and a list of Robinhood stock tokens, which it
            records on chain; the agent may pair a launch with a stock only when the company is plainly the joke, so that a trader gets it at a glance.
          </p>
          <p>
            Stock tokens are recognised by contract address, not by ticker. Many unrelated tokens on {CHAIN.name} reuse famous tickers; the official ones are
            proxies to Robinhood&apos;s token beacon and their names end in &ldquo;• Robinhood Token&rdquo;. The home page lists the pairs Pons accepts right now, read
            from the Pons contract.
          </p>

          <h2 id="launch">Going live on Pons</h2>
          <p>
            The agent launches through the {BRAND.name} launcher contract, never directly. The launcher creates the token on the Pons factory with the
            treasury as the creator fee recipient, zero extra creator tax and Pons&apos; own buyback route turned off, and it pays Pons its launch charge and nothing
            more. There is no opening buy, so the whole supply starts on the bonding curve.
          </p>
          <p>
            On Pons a new token is priced by a bonding curve: each purchase nudges the price up. Once every curve token is bought, the market shifts into a Uniswap pool
            and its liquidity is locked. Only the agent&apos;s wallet may call the launcher, and at most one launch every {d.launcherMinIntervalSec / 60} minutes,
            so even a stolen key could not spray launches or drain the budget quickly.
          </p>

          <h2 id="money">Fees, buybacks and the budget</h2>
          <p>
            Each trade on Pons carries a fee, and Pons forwards a share of it to the creator. For {BRAND.name} launches that is the treasury. Fees build
            up in Pons&apos; fee escrow; anyone can call the treasury to sweep and collect them, and the money can only go to the treasury.
          </p>
          <ul>
            <li>
              <b>Buyback side ({d.buybackShareBps / 100}%).</b> Saved to buy {BRAND.symbol} and send it to the burn address. Until {BRAND.symbol} exists, it
              is kept and cannot be spent on anything else.
            </li>
            <li>
              <b>Launch side ({100 - d.buybackShareBps / 100}%).</b> Pays the Pons launch fee for each new token and a fixed{" "}
              {Number(d.opsAllowanceWei) / 1e18} ETH per launch to the agent&apos;s wallet for gas and tools. Above {Number(d.budgetCeilingWei) / 1e18} ETH,
              the overflow joins the buyback side.
            </li>
          </ul>
          <p>
            Buybacks are deliberately small and spaced: at most {Number(d.maxBuybackPerCallWei) / 1e18} ETH each, at least {d.minBuybackIntervalSec / 3600}{" "}
            hour apart, each with a minimum amount of {BRAND.symbol} the agent quotes just before. A buy that anyone could trigger with any price limit would be
            easy prey for sandwich bots, because neither the Pons curve nor its pool carries a price oracle to check against. If the agent stops for{" "}
            {d.fallbackAfterSec / 86400} days, anyone may run the same small buyback so the reserve never gets stranded.
          </p>
          <p>
            Launches paired with a stock earn their fees in that stock. The treasury splits those the same way and the agent swaps each half to ETH on Uniswap,
            keeping each half on its own side. Pool fees after graduation are often taken in the memecoin itself; only Pons&apos; own operator may convert those,
            so they reach the treasury when Pons sweeps them.
          </p>

          <h2 id="learn">How the playbook learns</h2>
          <p>
            Each launch is measured an hour, a day and a week after it goes out: market cap, trading volume, graduation, and what it paid its creator. Each round the agent
            groups those results by topic type, pair, name length and launch hour, and a model suggests edits and has to justify each one with figures.
            Code then rejects any edit outside fixed bounds and logs every one on the <Link href="/playbook">playbook page</Link>. Learning starts only after
            several launches have traded for sixty minutes or more.
          </p>

          <h2 id="safety">Safety rules</h2>
          <p>These are hard-coded apart from the playbook; the learning loop cannot reach them.</p>
          <ul>
            <li>Never sends, buys or holds launched tokens; the contracts cannot do it either.</li>
            <li>Skips private people, minors, deaths, disasters, hate, sexual and violent themes, and repeats.</li>
            <li>Never uses its own name, a name or ticker it used before, real brands or real people.</li>
            <li>Two filters on every topic and name: a static blocklist, followed by an independent model that judges against the rules.</li>
            <li>Paid models must stay under a price ceiling, paid calls under an hourly ceiling, and every round under a spending cap.</li>
          </ul>

          <h2 id="parts">What runs where</h2>
          <ul>
            <li>
              <b>Contracts on {CHAIN.name}:</b> the launcher, the treasury and, once {BRAND.symbol} exists, the buyback contract. No owner, no admin, no
              upgrade. See <Link href="/contracts">Contracts</Link>.
            </li>
            <li>
              <b>The agent:</b> a keeper process on a server, holding the hot wallet that signs launches. It calls X, a language model and an image model, all
              paid services, and writes its log for this site to read.
            </li>
            <li>
              <b>This site:</b> reads the chain, Pons and the agent&apos;s log. It cannot launch, move funds or change a rule.
            </li>
          </ul>

          <h2 id="check-it">Verify it</h2>
          <ul>
            <li>Every launch links to its token and its launch transaction on Blockscout.</li>
            <li>The Dev holds column reads the launcher&apos;s, the treasury&apos;s and the agent wallet&apos;s balance of each token.</li>
            <li>The treasury&apos;s balances and totals are public views on the contract.</li>
            <li>Each launch commits a hash of the evidence and of the playbook version it used, so the log cannot be rewritten afterwards.</li>
          </ul>

          <h2 id="words">Words used on this site</h2>
          <dl className="rows">
            <div>
              <dt>Pons</dt>
              <dd className="!font-sans">The launchpad for new tokens on {CHAIN.name}.</dd>
            </div>
            <div>
              <dt>Pair</dt>
              <dd className="!font-sans">What a token is quoted in: ETH, USDG or an approved stock token.</dd>
            </div>
            <div>
              <dt>Creator fees</dt>
              <dd className="!font-sans">The creator&apos;s cut of every trading fee on Pons.</dd>
            </div>
            <div>
              <dt>Bonding curve</dt>
              <dd className="!font-sans">The opening market of a Pons token, where price rises with every buy.</dd>
            </div>
            <div>
              <dt>Graduation</dt>
              <dd className="!font-sans">The curve is bought out and trading continues in a Uniswap pool whose liquidity is locked.</dd>
            </div>
            <div>
              <dt>Buyback</dt>
              <dd className="!font-sans">Spending fees on {BRAND.symbol} and burning what was bought.</dd>
            </div>
            <div>
              <dt>Sample</dt>
              <dd className="!font-sans">Invented data shown until the agent and contracts are live, always tagged.</dd>
            </div>
          </dl>

          <h2 id="faq">Questions</h2>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q} open>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
