import Link from "next/link";
import { CopyCaFoot } from "@/components/CopyCa";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import { Wordmark, XGlyph } from "@/components/ui";
import { BRAND, CHAIN, hasGithub, hasX } from "@/config/brand";

const COLUMNS = [
  {
    title: "Agent",
    links: [
      { href: "/round", label: "Current round" },
      { href: "/launches", label: "All launches" },
      { href: "/playbook", label: "Playbook" },
    ],
  },
  {
    title: "Money",
    links: [
      { href: "/earnings", label: "Earnings and treasury" },
      { href: "/spend", label: "Spend" },
      { href: "/token", label: `${BRAND.symbol} token` },
    ],
  },
  {
    title: "Check it",
    links: [
      { href: "/docs", label: "How it works" },
      { href: "/contracts", label: "Contracts" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t-2 border-ink bg-paper">
      <div className="wrap grid gap-10 py-12 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-4">
          <Wordmark size={26} />
          <p className="m-0 max-w-[44ch] text-[14px] text-ink-2">{BRAND.tagline}</p>
          <CopyCaFoot />
          <div className="flex flex-wrap items-center gap-3">
            {hasX ? (
              <a href={BRAND.x} target="_blank" rel="noreferrer" className="btn btn-sm" aria-label={`${BRAND.name} on X`}>
                <XGlyph size={14} /> {BRAND.xHandle}
              </a>
            ) : null}
            {hasGithub ? (
              <a href={BRAND.github} target="_blank" rel="noreferrer" className="btn btn-sm">
                Source code
              </a>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {COLUMNS.map((c) => (
            <div key={c.title}>
              <p className="m-0 mb-3 font-mono text-[11px] tracking-[0.08em] text-ink-4 uppercase">{c.title}</p>
              <ul className="m-0 grid list-none gap-2 p-0 text-[14px]">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="tlink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="wrap">
        <p className="m-0 py-5 text-[12.5px] text-ink-4">
          {BRAND.name} is an experiment: an AI agent that launches memecoins on {CHAIN.name}. Every token it creates is a joke about the news; they
          promise nothing and may end up worthless. This site gives no financial advice.
        </p>
        </div>
      </div>
    </footer>
  );
}
