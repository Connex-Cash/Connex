import type { Metadata } from "next";
import { BRAND, CHAIN } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Terms",
  description: `Terms of use for ${BRAND.name}: what the site is, what the tokens are and are not, and the risks of trading memecoins on ${CHAIN.name}.`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <main>
      <section className="band first">
        <div className="wrap narrow">
          <div className="band-h">
            <div>
              <div className="kicker">The fine print</div>
              <h1 className="title">Terms</h1>
              <p>Plain words, because the risks are plain too.</p>
            </div>
          </div>
          <div className="doc panel pad">
            <h3>What this site is</h3>
            <p>
              {BRAND.name} is an experiment: an AI agent that launches memecoins on {CHAIN.name} through the Pons launchpad, and a website that shows what it
              does. The site never holds your funds. Anything you buy, you buy from your own wallet, on contracts you can read.
            </p>
            <h3>What the tokens are</h3>
            <p>
              Tokens launched by the agent are jokes about things people are talking about. They have no team, no roadmap and no promise of value. Most
              memecoins go to zero. Do not buy more than you would happily lose.
            </p>
            <h3>The agent can be wrong</h3>
            <p>
              A model picks the topics and writes the names. It follows safety rules, but it can misjudge a topic or a joke. If a launch offends you or names
              something it should not, tell us on X and it will be noted in the playbook.
            </p>
            <h3>Contracts and data</h3>
            <p>
              The contracts have no owner and cannot be changed once deployed, which also means mistakes in them cannot be patched. Data on this site comes from
              the chain, from Pons and from the agent&apos;s own log, and can be delayed or briefly wrong. The chain is the record.
            </p>
            <h3>No advice</h3>
            <p>Nothing here is financial, legal or tax advice. Check what applies where you live before trading.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
