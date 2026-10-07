import { ChainTag } from "@/components/ui";
import { CHAIN } from "@/config/brand";
import type { PairStatus } from "@/lib/onchain/read";

export function PairsTable({ pairs }: { pairs: PairStatus[] }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl min-w-[560px]">
        <thead>
          <tr>
            <th>Pair</th>
            <th>Kind</th>
            <th>Pons accepts it</th>
            <th>Contract</th>
          </tr>
        </thead>
        <tbody>
          {pairs.map((p) => (
            <tr key={p.symbol}>
              <td>
                <b>{p.symbol}</b> <span className="text-[13px] text-ink-2">{p.name}</span>
              </td>
              <td className="text-[13px] text-ink-2">{p.kind === "native" ? "native gas token" : p.kind === "stable" ? "dollar stablecoin" : "Robinhood stock token"}</td>
              <td className="text-[13px]">
                {p.approved === true ? <ChainTag>yes</ChainTag> : p.approved === false ? <span className="tag text-down">no</span> : <span className="tag">unread</span>}
                {p.kind === "stock" && p.verified === false ? <span className="tag ml-2 text-down">not official</span> : null}
              </td>
              <td className="num text-[12.5px]">
                {p.address ? (
                  <a className="tlink" href={`${CHAIN.explorer}/token/${p.address}`} target="_blank" rel="noreferrer">
                    {p.address.slice(0, 8)}…{p.address.slice(-4)}
                  </a>
                ) : (
                  <span className="text-ink-4">native</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
