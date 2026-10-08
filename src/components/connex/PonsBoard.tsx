import { TokenArt } from "@/components/ui";
import { PONS } from "@/config/brand";
import { pairByAddress } from "@/config/pairs";
import type { PonsLaunch } from "@/lib/onchain/read";
import { ago, usd } from "@/lib/format";

/** Real launches on Pons by anyone, read from the factory's events: the market every CONNEX token walks into. */
export function PonsBoard({ coins, now, ethUsd }: { coins: PonsLaunch[]; now: number; ethUsd: number | null }) {
  if (!coins.length) return <div className="panel empty">The Pons factory could not be read just now. This list refreshes every minute.</div>;
  return (
    <div className="runners">
      {coins.map((c) => {
        const pair = pairByAddress(c.pairToken);
        const mcap = c.market && ethUsd ? c.market.mcapEth * ethUsd : null;
        return (
          <a key={c.token} className="runner" href={PONS.page(c.token)} target="_blank" rel="noreferrer">
            <TokenArt symbol={c.symbol} size={64} className="rounded-[14px]" />
            <div>
              <b>{c.name}</b>
              <span className="r-k">
                ${c.symbol} · {pair?.symbol ?? "token"} pair · {ago(c.at, now)} ago
              </span>
              <span className="r-v">{mcap ? usd(mcap) : c.market ? `${Math.round(c.market.progress)}% curve` : "–"}</span>
              <span className="r-k">
                {c.market ? (c.market.phase === 0 ? `${Math.round(c.market.progress)}% to graduation` : "graduated") : "market unread"}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
