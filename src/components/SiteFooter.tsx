import Link from "next/link";
import { CaPill } from "@/components/CopyCa";
import { ChainLine } from "@/components/site/StatusStrip";
import { XGlyph } from "@/components/ui";
import { BRAND, CHAIN, hasGithub, hasX } from "@/config/brand";

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div>
          <b>
            {BRAND.name} is an experiment: an AI agent that launches memecoins on {CHAIN.name}.
          </b>{" "}
          Nothing on this site is financial advice. Every token it creates is a joke about the news, promises nothing and can end up worthless.
          <div className="foot-links">
            <Link href="/docs">How it works</Link>
            <Link href="/contracts">Contracts</Link>
            <Link href="/token">{BRAND.symbol}</Link>
            <Link href="/terms">Terms</Link>
            {hasGithub ? (
              <a href={BRAND.github} target="_blank" rel="noreferrer">
                Source
              </a>
            ) : null}
          </div>
        </div>
        <div className="foot-r">
          <div className="foot-btns">
            <CaPill id="ca-foot" />
            <Link className="btn ghost-lime" href="/round">
              Live round
            </Link>
            {hasX ? (
              <a className="btn" href={BRAND.x} target="_blank" rel="noreferrer">
                <XGlyph size={16} />
                {BRAND.xHandle}
              </a>
            ) : null}
          </div>
          <ChainLine />
        </div>
      </div>
    </footer>
  );
}
