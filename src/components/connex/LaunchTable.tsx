import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { ChainTag, SampleTag, TokenAvatar } from "@/components/ui";
import { CHAIN, PONS, shortAddress } from "@/config/brand";
import type { Launch } from "@/lib/agent/types";
import { ago, usd, utc } from "@/lib/format";

export function devHoldsText(l: Launch): { text: string; ok: boolean | null } {
  if (l.mode === "sample") return { text: "0", ok: null };
  const h = l.devHolds;
  if (!h) return { text: "unread", ok: null };
  const vals = [h.launcher, h.treasury, ...(h.operator ? [h.operator] : [])];
  if (vals.some((v) => v === "unknown")) return { text: "unread", ok: null };
  const total = vals.reduce((a, v) => a + BigInt(v), 0n);
  return total === 0n ? { text: "0", ok: true } : { text: (Number(total) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 }), ok: false };
}

export function LaunchTable({ launches, ethUsd, now, limit }: { launches: Launch[]; ethUsd: number | null; now: number; limit?: number }) {
  const rows = limit ? launches.slice(0, limit) : launches;
  if (!rows.length) {
    return <p className="note m-0">No launches yet. The first one appears here the moment the launcher contract records it.</p>;
  }
  return (
    <div className="tbl-wrap">
      <table className="tbl min-w-[760px]">
        <thead>
          <tr>
            <th>#</th>
            <th>Token</th>
            <th>Launched</th>
            <th className="r">Market cap</th>
            <th className="r">Creator fees</th>
            <th className="r">Dev holds</th>
            <th>Links</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const holds = devHoldsText(l);
            const mcap = l.market && ethUsd ? l.market.mcapEth * ethUsd : null;
            return (
              <tr key={l.id}>
                <td className="num text-ink-4">{l.mode === "sample" ? "s" : l.index + 1}</td>
                <td>
                  <Link href={`/launches/${l.id}`} className="flex min-w-0 items-center gap-3 no-underline">
                    <TokenAvatar symbol={l.symbol} size={34} />
                    <span className="grid min-w-0">
                      <b className="truncate">{l.name}</b>
                      <span className="num truncate text-[12.5px] text-ink-2">
                        ${l.symbol} · {l.pair.symbol} pair{l.lane === "breaking" ? " · breaking" : ""}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="num text-[13px] whitespace-nowrap text-ink-2">
                  {utc(l.launchedAt)}
                  <br />
                  <span className="text-ink-4">{ago(l.launchedAt, now)} ago</span>
                </td>
                <td className="num r">{l.mode === "sample" ? <span className="text-ink-4">–</span> : l.market ? usd(mcap) : l.pair.symbol === "ETH" ? "…" : <span className="text-ink-4">in {l.pair.symbol}</span>}</td>
                <td className="num r">
                  {l.mode === "sample" ? (
                    <span className="inline-flex items-center gap-2">
                      ≈{l.sampleFeesEth} ETH <SampleTag />
                    </span>
                  ) : (
                    <span className="text-ink-4">see treasury</span>
                  )}
                </td>
                <td className="num r">
                  <span className="inline-flex items-center gap-2">
                    {holds.text}
                    {holds.ok === true ? <ChainTag>checked</ChainTag> : holds.ok === false ? <span className="tag text-down">holds</span> : l.mode === "sample" ? <SampleTag /> : null}
                  </span>
                </td>
                <td className="text-[13px] whitespace-nowrap">
                  {l.address ? (
                    <span className="flex gap-3">
                      <a href={PONS.page(l.address)} target="_blank" rel="noreferrer" className="tlink inline-flex items-center gap-0.5">
                        Pons <ArrowUpRight size={11} />
                      </a>
                      <a href={`${CHAIN.explorer}/token/${l.address}`} target="_blank" rel="noreferrer" className="tlink inline-flex items-center gap-0.5" title={l.address}>
                        {shortAddress(l.address, 4, 3)} <ArrowUpRight size={11} />
                      </a>
                    </span>
                  ) : (
                    <span className="text-ink-4">no address (sample)</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
