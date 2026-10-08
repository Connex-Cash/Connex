import Link from "next/link";
import { Gauge } from "@/components/site/StatusStrip";
import { NavTabs } from "@/components/site/NavLinks";
import { Wordmark, XGlyph } from "@/components/ui";
import { NavWallet } from "@/components/wallet/WalletButton";
import { BRAND, TOKEN, hasX } from "@/config/brand";
import { launchesLive } from "@/config/contracts";
import { keeperStatus } from "@/lib/agent/data";

export async function SiteHeader() {
  const status = await keeperStatus().catch(() => ({ running: false, lastBeat: null }));
  const live = status.running && launchesLive();
  return (
    <header className="bar">
      <div className="strip">
        <div className="wrap">
          <span className={`pulse ${live ? "" : "idle"}`}>
            <i />
            {live ? "Agent running" : "Sample mode"}
          </span>
          <span className="sep hide-xs" />
          <span>
            {TOKEN.isLive ? (
              <>
                <b>{BRAND.symbol} is live on Pons.</b> <span className="hide-xs">Copy the address only from this site.</span>
              </>
            ) : (
              <>
                <b>{BRAND.symbol} is not out yet.</b> <span className="hide-xs">The rounds below run on sample data until the contracts go live.</span>
              </>
            )}
          </span>
          {hasX ? (
            <a className="hide-xs" href={BRAND.x} target="_blank" rel="noreferrer">
              Get the launch post
            </a>
          ) : null}
        </div>
      </div>
      <div className="wrap nav">
        <Link href="/" aria-label={`${BRAND.name} home`}>
          <Wordmark />
        </Link>
        <NavTabs />
        <div className="nav-r">
          <span className={`modechip ${live ? "live" : ""}`}>{live ? "Live" : "Sample"}</span>
          {hasX ? (
            <a className="btn hide-sm xbtn" href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on X`}>
              <XGlyph size={16} />
              <span className="xh">{BRAND.xHandle}</span>
            </a>
          ) : null}
          <span className="netpill" aria-label="Network">
            <Link href="/" className="on">
              <span className="lg">Robinhood</span>
              <span className="sh">RH</span>
            </Link>
            <a href="https://www.ponsfamily.com/launchpad" target="_blank" rel="noreferrer">
              Pons
            </a>
          </span>
          <NavWallet />
          <Link className="btn go" href="/token">
            {BRAND.symbol}
            <span className="hide-xxs">{TOKEN.isLive ? " buy" : " soon"}</span>
          </Link>
        </div>
      </div>
      <Gauge />
    </header>
  );
}
