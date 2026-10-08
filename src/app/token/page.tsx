import type { Metadata } from "next";
import Link from "next/link";
import { ChainTrade } from "@/components/ChainTrade";
import { CaPill } from "@/components/CopyCa";
import { BandHead } from "@/components/ui";
import { JsonLd } from "@/components/JsonLd";
import { BRAND, CHAIN, PONS, TOKEN, explorerToken, isAddress } from "@/config/brand";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: `${BRAND.name} (${BRAND.symbol}) Token`,
  description: `${BRAND.symbol} is the ${BRAND.name} token on ${CHAIN.name}. Half of every creator fee the agent earns buys it back and burns it. Contract address and swap.`,
  path: "/token",
});

export default function TokenPage() {
  const token = isAddress(BRAND.ca) ? BRAND.ca : null;
  return (
    <main>
      <JsonLd data={breadcrumbs([{ name: `${BRAND.symbol} token`, path: "/token" }])} />
      <section className="band first">
        <div className="wrap">
          <BandHead
            kicker="The token"
            title={`${BRAND.name} (${BRAND.symbol}) Token`}
            h1
            aside={<span className={`chip ${TOKEN.isLive ? "good" : "warn"}`}>{TOKEN.isLive ? "live on Pons" : "not launched yet"}</span>}
          >
            {BRAND.symbol} is the token behind the agent and never one of its launches. Half of every creator fee those launches earn buys {BRAND.symbol} on the
            market and burns it.
          </BandHead>
          <div className="cols2">
            <div className="grid content-start gap-5">
              <div className="panel pad grid gap-3">
                <h3>Contract address on {CHAIN.name}</h3>
                <div>
                  <CaPill id="ca-token" />
                </div>
                <p className="m-0 text-[14px] text-ink-2" data-testid="ca-full">
                  {token ? (
                    <span className="num break-all">{token}</span>
                  ) : (
                    <>Published here on launch day. Until then, ignore any {BRAND.symbol} address that is not shown on this site.</>
                  )}
                </p>
                {token ? (
                  <p className="m-0 flex flex-wrap gap-4 text-[14px]">
                    <a className="more" href={explorerToken(token)} target="_blank" rel="noreferrer">
                      Blockscout
                    </a>
                    <a className="more" href={PONS.page(token)} target="_blank" rel="noreferrer">
                      Pons launch page
                    </a>
                  </p>
                ) : null}
              </div>
              <div className="panel pad doc">
                <h3 style={{ fontSize: 20 }}>What backs the buyback</h3>
                <p>
                  Only trading. Each launch pays its creator slice to the treasury, the treasury puts half of it aside, and the agent spends that half on{" "}
                  {BRAND.symbol} in small pieces, sending what it buys to the burn address. Before {BRAND.symbol} exists, the buyback half is saved for the
                  first buyback. The live numbers are on <Link href="/earnings">Earnings</Link>.
                </p>
                <h3 style={{ fontSize: 20, marginTop: 18 }}>How to buy</h3>
                <ol>
                  <li>Connect an EVM wallet; the site adds {CHAIN.name} for you.</li>
                  <li>Keep some ETH on {CHAIN.name} for the swap and the gas.</li>
                  <li>Check the address above, enter an amount and sign. Quotes come from the chain; set your slippage before you sign.</li>
                </ol>
              </div>
            </div>
            <div className="stick">
              <ChainTrade token={token} symbol={BRAND.ticker} title={`Swap ${BRAND.symbol}`} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
