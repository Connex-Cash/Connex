import type { Metadata } from "next";
import { requestNow } from "@/lib/now";
import { JsonLd } from "@/components/JsonLd";
import { SampleBanner } from "@/components/connex/Treasury";
import { BRAND } from "@/config/brand";
import { playbook } from "@/lib/agent/data";
import { utc } from "@/lib/format";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const revalidate = 120;

export const metadata: Metadata = pageMeta({
  title: "Playbook",
  description: `The rules ${BRAND.name} launches by: scoring weights, the trader gate, naming and image style, and every change it made to them with its evidence.`,
  path: "/playbook",
});

export default async function PlaybookPage() {
  const now = requestNow();
  const b = await playbook(now);
  const w = b.weights;
  const weights = [
    ["Momentum", w.momentum, "how fast the topic is spreading right now"],
    ["Memeability", w.memeability, "how readily people riff on it and pass it along"],
    ["Originality", w.originality, "how far it is from tokens that already exist"],
    ["Trader appeal", w.appeal, "the skeptical trader's score, also a hard gate"],
  ] as const;
  return (
    <main className="wrap">
      <JsonLd data={breadcrumbs([{ name: "Playbook", path: "/playbook" }])} />
      <div className="page-h">
        <h1>Playbook</h1>
        <p>
          What the agent believes about which trends convert. It rewrites these rules from its own results, one evidenced change at a time. Some things are
          deliberately outside its reach: the safety rules, the 50/50 split and the contracts.
        </p>
      </div>
      <div className="grid gap-10 pt-8">
        {b.mode === "sample" ? <SampleBanner>The agent is not running yet: this is the starting playbook it ships with, and example log entries.</SampleBanner> : null}
        <section aria-labelledby="w-h" className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            <h2 id="w-h" className="m-0 text-[26px]">
              How a topic is scored
            </h2>
            <p className="m-0 text-ink-2">
              Version {b.version}, updated {utc(b.updatedAt)}. A topic needs at least {b.gate}/10 from the skeptical trader before any of this matters.
            </p>
            <ul className="m-0 grid list-none gap-3 p-0">
              {weights.map(([k, v, hint]) => (
                <li key={k} className="grid gap-1">
                  <div className="flex justify-between text-[14px]">
                    <b>{k}</b>
                    <span className="num">{Math.round(v * 100)}%</span>
                  </div>
                  <span className="meter">
                    <i style={{ width: `${v * 100}%` }} />
                  </span>
                  <span className="text-[13px] text-ink-2">{hint}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-4">
            <h2 className="m-0 text-[26px]">Rules it follows now</h2>
            <ol className="m-0 grid gap-2 pl-5">
              {b.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ol>
            <dl className="rows">
              <div>
                <dt>Naming style</dt>
                <dd className="!font-sans !text-left">{b.naming}</dd>
              </div>
              <div>
                <dt>Image style</dt>
                <dd className="!font-sans !text-left">{b.imageStyle}</dd>
              </div>
              <div>
                <dt>Where it searches</dt>
                <dd className="!font-sans !text-left">{b.searches.join("; ")}</dd>
              </div>
            </dl>
          </div>
        </section>
        <section aria-labelledby="log-h" className="grid gap-4">
          <h2 id="log-h" className="m-0 text-[26px]">
            What it changed, and why
          </h2>
          <ol className="steps">
            {b.log.map((e) => (
              <li key={e.at}>
                <span className="n">{new Date(e.at).toISOString().slice(5, 10)}</span>
                <div>
                  <h3>{e.title}</h3>
                  <p>{e.change}</p>
                  <p className="mt-1">{e.reason}</p>
                  <p className="mt-1 font-mono text-[12.5px] text-ink-4">{e.evidence}</p>
                </div>
                <span className="t">{utc(e.at).split(", ")[1]}</span>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="fixed-h" className="doc">
          <h2 id="fixed-h" className="!mt-0">
            What the playbook can never change
          </h2>
          <ul>
            <li>Never on the table: private individuals, minors, deaths and disasters, hateful, sexual or violent material, and any repeat of an earlier launch.</li>
            <li>Names it never uses: its own name, a name or ticker it used before, real brands, real people, or anything imitating another project.</li>
            <li>The fee split, the launch path and the treasury: those live in contracts with no owner.</li>
            <li>The spending limits on models and tools.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
