import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { ChainTag, TokenAvatar } from "@/components/ui";
import { BRAND, PONS } from "@/config/brand";
import { pairByAddress } from "@/config/pairs";
import type { PonsLaunch } from "@/lib/onchain/read";
import { ago, usd } from "@/lib/format";

/** Real launches on Pons by anyone, read from the factory's events: the market CONNEX launches into. Not CONNEX tokens. */
export function PonsBoard({ coins, now, ethUsd }: { coins: PonsLaunch[]; now: number; ethUsd: number | null }) {
  if (!coins.length) return <p className="note m-0">The Pons factory could not be read just now. This list refreshes every minute.</p>;
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-0 border-t-2 border-ink p-0 md:grid-cols-2">
      {coins.map((c) => {
        const pair = pairByAddress(c.pairToken);
        const mcap = c.market && ethUsd ? c.market.mcapEth * ethUsd : null;
        return (
          <li key={c.token} className="flex min-w-0 items-center gap-3 border-b border-line py-3 md:odd:pr-6 md:even:pl-6">
            <TokenAvatar symbol={c.symbol} size={30} />
            <div className="grid min-w-0 flex-1">
              <a href={PONS.page(c.token)} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 font-semibold no-underline">
                <span className="truncate">{c.name}</span> <ArrowUpRight size={11} className="shrink-0" />
              </a>
              <span className="num truncate text-[12.5px] text-ink-2">
                ${c.symbol} · {pair?.symbol ?? "token"} pair · {ago(c.at, now)} ago
                {c.market ? ` · ${c.market.phase === 0 ? `${Math.round(c.market.progress)}% to graduation` : "graduated"}` : ""}
              </span>
            </div>
            <span className="num shrink-0 text-[13px]">{mcap ? usd(mcap) : <span className="text-ink-4">–</span>}</span>
          </li>
        );
      })}
      <li className="col-span-full flex flex-wrap items-center gap-2 pt-3 text-[12.5px] text-ink-4">
        <ChainTag>Pons factory events</ChainTag> Launches by anyone on Pons, not by {BRAND.name}. Shown because this is the market every {BRAND.name} token competes in.
      </li>
    </ul>
  );
}
