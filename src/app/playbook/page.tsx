import type { Metadata } from "next";
import { requestNow } from "@/lib/now";
import { JsonLd } from "@/components/JsonLd";
import { BandHead } from "@/components/ui";
import { BRAND } from "@/config/brand";
import { playbook } from "@/lib/agent/data";
import { ago } from "@/lib/format";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const revalidate = 120;

export const metadata: Metadata = pageMeta({
  title: "Playbook",
  description: `The rules ${BRAND.name} launches by: scoring weights, the trader gate, naming and image style, and every change it made to them with its evidence.`,
  path: "/playbook",
});

type Rule = { text: string; why: string; badge: string; fresh?: boolean };

export default async function PlaybookPage() {
  const now = requestNow();
  const b = await playbook(now);
  const w = b.weights;
  const pc = (v: number) => `${Math.round(v * 100)}%`;
  const rules: Rule[] = [
    ...b.log.map((e) => ({
      text: `${e.title}. ${e.change}`,
      why: `${e.reason} ${e.evidence}`,
      badge: `Changed ${ago(e.at, now)} ago`,
      fresh: now - e.at < 12 * 3600_000,
    })),
    {
      text: `Launch only what a trader would buy: a topic needs ${b.gate}/10 or more from the skeptical trader before anyone names or draws it.`,
      why: "Fixed by the operator. The learning loop cannot lower it.",
      badge: "Locked",
    },
    {
      text: `Weigh topics ${pc(w.momentum)} on momentum, ${pc(w.memeability)} on meme value, ${pc(w.originality)} on freshness and ${pc(w.appeal)} on trader appeal.`,
      why: "The weights always add up to 1. A review may move each by at most 0.1 per change, within 0.05 to 0.6.",
      badge: `v${b.version}`,
    },
    ...b.rules.map((r) => ({ text: r, why: "Part of the current playbook; it stays until the numbers say otherwise.", badge: "Rule" })),
    { text: `Naming: ${b.naming}`, why: "House style for names, tickers and the one-paragraph story.", badge: "Style" },
    { text: `Logos: ${b.imageStyle}`, why: "Handed to the image model with every drawing request.", badge: "Style" },
    {
      text: `Look in: ${b.searches.join("; ")}.`,
      why: "The searches are picked from a fixed allowlist; a review can reorder them but not invent new ones.",
      badge: "Search",
    },
  ];
  return (
    <main>
      <JsonLd data={breadcrumbs([{ name: "Playbook", path: "/playbook" }])} />
      <section className="band first">
        <div className="wrap narrow">
          <BandHead
            kicker="Learning loop"
            title="The Playbook"
            h1
            aside={
              <span className="chip">
                <span className="blip" /> Reviewed {ago(b.updatedAt, now)} ago{b.mode === "sample" ? " · sample" : ""}
              </span>
            }
          >
            What the agent believes about which trends convert, right now. It edits these rules after rounds, one evidenced change at a time.
            {b.mode === "sample" ? " The agent is not running yet: this is the starting playbook plus example changes." : ""}
          </BandHead>
          <ol className="rulelist">
            {rules.map((r) => (
              <li key={r.text} className={r.fresh ? "fresh" : ""}>
                <span className="rt">{r.text}</span>
                <span className={`badge ${r.fresh ? "new" : ""}`}>{r.badge}</span>
                <span className="re">{r.why}</span>
              </li>
            ))}
          </ol>
          <p className="faint" style={{ fontSize: 13.5, marginTop: 22 }}>
            Out of the playbook&apos;s reach: the dev-holds-zero rule, the safety rules, the 50/50 fee split, the spending limits and the contracts. Any change
            to wording waits for the owner&apos;s approval; the agent can only nudge weights and reorder searches on its own.
          </p>
        </div>
      </section>
    </main>
  );
}
