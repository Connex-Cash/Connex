import type { Metadata } from "next";
import Link from "next/link";
import { ChainTrade } from "@/components/ChainTrade";
import { CopyCaBlock } from "@/components/CopyCa";
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
    <main className="wrap">
      <JsonLd data={breadcrumbs([{ name: `${BRAND.symbol} token`, path: "/token" }])} />
      <div className="page-h">
        <h1>
          {BRAND.name} ({BRAND.symbol}) Token
        </h1>
        <p>
          {BRAND.symbol} is the token behind the agent. It is never one of the launches: half of every creator fee those launches earn is used to buy{" "}
          {BRAND.symbol} on the market and burn it.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-10 pt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="grid content-start gap-6">
          {!TOKEN.isLive ? (
            <p className="note m-0">
              <b>Contract address coming soon.</b> {BRAND.symbol} has not launched. The swap card switches on by itself once the address is published here.
              Until then, ignore any {BRAND.symbol} address that is not shown on this site.
            </p>
          ) : null}
          <CopyCaBlock />
          {token ? (
            <p className="m-0 flex flex-wrap gap-4 text-[14px]">
              <a className="tlink" href={explorerToken(token)} target="_blank" rel="noreferrer">
                Blockscout
              </a>
              <a className="tlink" href={PONS.page(token)} target="_blank" rel="noreferrer">
                Pons launch page
              </a>
            </p>
          ) : null}
          <div className="doc !text-[16px]">
            <h2 className="!mt-0">What backs the buyback</h2>
            <p>
              Only trading. Each launch pays its creator share to the treasury, the treasury puts half of it aside, and the agent spends that half on{" "}
              {BRAND.symbol} in small pieces, sending what it buys to the burn address. Before {BRAND.symbol} exists, the buyback half is saved and waits for
              the first buyback. See the live numbers on <Link href="/earnings">Earnings</Link>.
            </p>
            <h2>How to buy</h2>
            <ol>
              <li>Connect an EVM wallet; the site adds {CHAIN.name} for you.</li>
              <li>Hold some ETH on {CHAIN.name} for the swap and gas.</li>
              <li>Check the contract address above, enter an amount and sign the swap. Quotes come from the chain; set your slippage before you sign.</li>
            </ol>
          </div>
        </div>
        <div className="lg:sticky lg:top-[110px] lg:self-start">
          <ChainTrade token={token} symbol={BRAND.ticker} title={`Swap ${BRAND.symbol}`} />
        </div>
      </div>
    </main>
  );
}
