import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { devHoldsText } from "@/components/connex/LaunchTable";
import { SampleBanner } from "@/components/connex/Treasury";
import { ChainTag, TokenAvatar } from "@/components/ui";
import { BRAND, CHAIN, PONS } from "@/config/brand";
import { CONTRACTS, OPERATOR } from "@/config/contracts";
import { launchById } from "@/lib/agent/data";
import { chainStat } from "@/lib/chainstat";
import { usd, utc } from "@/lib/format";

export const dynamic = "force-dynamic";

const isId = (id: string) => /^s-\d{1,10}$/.test(id) || /^0x[0-9a-fA-F]{40}$/.test(id);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const l = isId(id) ? await launchById(id) : null;
  return {
    title: l ? `${l.name} ($${l.symbol})` : "Launch",
    description: l ? `${l.name} ($${l.symbol}), launched by ${BRAND.name} on Pons: the story, the pair, the scores and what the dev side holds.` : undefined,
    robots: { index: false, follow: true },
  };
}

function Bal({ label, who, v }: { label: string; who: string | null; v: string | null | undefined }) {
  return (
    <div>
      <dt>
        {label}
        {who ? (
          <a className="tlink num block text-[12px]" href={`${CHAIN.explorer}/address/${who}`} target="_blank" rel="noreferrer">
            {who.slice(0, 10)}…
          </a>
        ) : null}
      </dt>
      <dd>{v == null ? "not set" : v === "unknown" ? "unread" : (Number(BigInt(v)) / 1e18).toLocaleString("en-US")}</dd>
    </div>
  );
}

export default async function LaunchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const [l, stat] = await Promise.all([launchById(id), chainStat().catch(() => null)]);
  if (!l) notFound();
  const holds = devHoldsText(l);
  const mcap = l.market && stat?.ethUsd ? l.market.mcapEth * stat.ethUsd : null;
  return (
    <main className="wrap">
      <div className="page-h">
        <Link href="/launches" className="tlink w-fit text-[14px]">
          All launches
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <TokenAvatar symbol={l.symbol} size={64} />
          <div className="min-w-0">
            <h1>{l.name}</h1>
            <p className="num !text-[14px]">
              ${l.symbol} · {l.pair.symbol} pair · {utc(l.launchedAt)}
              {l.round !== null ? ` · round ${l.round}` : ""}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-10 pt-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="grid content-start gap-6">
          {l.mode === "sample" ? <SampleBanner>A sample launch. This token does not exist; it shows what a launch page records.</SampleBanner> : null}
          {l.description ? <p className="lede m-0">{l.description}</p> : null}
          {l.source ? (
            <p className="m-0 text-[15px] text-ink-2">
              Found on: {l.source.url && /^https:\/\/x\.com\/(i\/web\/status|[A-Za-z0-9_]{1,15}\/status)\/\d{1,25}$/.test(l.source.url) ? (
                <a href={l.source.url} target="_blank" rel="noreferrer" className="tlink">
                  {l.source.label}
                </a>
              ) : (
                l.source.label
              )}
            </p>
          ) : null}
          {l.scores ? (
            <dl className="rows">
              <div>
                <dt>Topic</dt>
                <dd className="!font-sans">{l.scores.topic}</dd>
              </div>
              <div>
                <dt>Momentum · meme · fresh · trader</dt>
                <dd>
                  {l.scores.momentum} · {l.scores.memeability} · {l.scores.originality} · {l.scores.appeal}/10
                </dd>
              </div>
              <div>
                <dt>Weighted score</dt>
                <dd>{l.scores.score.toFixed(1)}</dd>
              </div>
            </dl>
          ) : null}
          {l.mode === "chain" ? (
            <dl className="rows">
              <div>
                <dt>Evidence hash (committed at launch)</dt>
                <dd>{l.sourceHash}</dd>
              </div>
              <div>
                <dt>Playbook hash</dt>
                <dd>{l.playbookHash}</dd>
              </div>
            </dl>
          ) : null}
        </div>
        <aside className="grid content-start gap-4">
          <div className="panel grid gap-3 p-5">
            <h2 className="m-0 text-[20px]">Dev holds</h2>
            <p className="m-0 flex items-center gap-2 font-display text-[40px] leading-none font-extrabold">
              {holds.text} {holds.ok ? <ChainTag>checked</ChainTag> : null}
            </p>
            {l.mode === "chain" && l.devHolds ? (
              <dl className="rows">
                <Bal label="Launcher contract" who={CONTRACTS.launcher} v={l.devHolds.launcher} />
                <Bal label="Treasury contract" who={CONTRACTS.treasury} v={l.devHolds.treasury} />
                <Bal label="Agent wallet" who={OPERATOR || null} v={l.devHolds.operator} />
              </dl>
            ) : (
              <p className="m-0 text-[13px] text-ink-2">For a real launch this reads the launcher, the treasury and the agent wallet balances from the chain.</p>
            )}
          </div>
          {l.mode === "chain" ? (
            <div className="panel grid gap-3 p-5">
              <h2 className="m-0 text-[20px]">Market</h2>
              <dl className="rows">
                <div>
                  <dt>Market cap</dt>
                  <dd>{l.market ? usd(mcap) : l.pair.symbol === "ETH" ? "unread" : `priced in ${l.pair.symbol}`}</dd>
                </div>
                <div>
                  <dt>Stage</dt>
                  <dd>{l.market ? (l.market.phase === 0 ? `curve, ${Math.round(l.market.progress)}% to graduation` : l.market.phase === 2 ? "Uniswap pool" : "graduating") : "–"}</dd>
                </div>
              </dl>
              {l.address ? (
                <div className="flex flex-wrap gap-3 text-[14px]">
                  <a className="btn btn-sm" href={PONS.page(l.address)} target="_blank" rel="noreferrer">
                    Trade on Pons <ArrowUpRight size={12} />
                  </a>
                  <a className="btn btn-sm" href={`${CHAIN.explorer}/token/${l.address}`} target="_blank" rel="noreferrer">
                    Blockscout <ArrowUpRight size={12} />
                  </a>
                  {l.tx ? (
                    <a className="btn btn-sm" href={`${CHAIN.explorer}/tx/${l.tx}`} target="_blank" rel="noreferrer">
                      Launch tx <ArrowUpRight size={12} />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
