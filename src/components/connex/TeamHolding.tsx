"use client";

import { useEffect, useState } from "react";
import { BRAND, TEAM, TOKEN, explorerAddress, isAddress } from "@/config/brand";
import { formatUnits, tokenBalance } from "@/lib/pons";
import { rpc } from "@/lib/rpc";

type Holding = { balance: bigint; supply: bigint } | null;

/** The team's whole $CONNEX position: one public wallet, its balance read live once the token exists. */
export function TeamHolding() {
  const token = isAddress(BRAND.ca) ? BRAND.ca : null;
  const [held, setHeld] = useState<Holding>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!token) return;
    let stop = false;
    (async () => {
      try {
        const [balance, supplyHex] = await Promise.all([
          tokenBalance(token, TEAM.wallet),
          rpc<string>("eth_call", [{ to: token, data: "0x18160ddd" }, "latest"]),
        ]);
        if (!stop) setHeld({ balance, supply: BigInt(supplyHex) });
      } catch {
        if (!stop) setFailed(true);
      }
    })();
    return () => {
      stop = true;
    };
  }, [token]);

  const pct = held && held.supply > 0n ? Number((held.balance * 1_000_000n) / held.supply) / 10_000 : null;

  return (
    <div className="panel pad doc" data-testid="team-holding">
      <h3 style={{ fontSize: 20 }}>Team holding</h3>
      <p>
        {TOKEN.isLive ? "At launch the team bought" : "At launch the team makes one first buy:"} {TEAM.launchBuyEth} ETH of {BRAND.symbol}, about{" "}
        {TEAM.launchBuyPct}% of the supply, on the bonding curve like any other buy. No free allocation, and no other team wallet.
      </p>
      <p className="m-0 grid gap-1 text-[14px]">
        <span>
          Wallet:{" "}
          <a className="num break-all" href={explorerAddress(TEAM.wallet)} target="_blank" rel="noreferrer">
            {TEAM.wallet}
          </a>
        </span>
        <span>
          Now holds:{" "}
          <b className="num">
            {!token
              ? `read live once ${BRAND.symbol} is launched`
              : failed
                ? "could not be read right now"
                : held
                  ? `${formatUnits(held.balance, 18, 2)} ${BRAND.ticker}${pct !== null ? ` (${pct.toFixed(2)}% of supply)` : ""}`
                  : "reading the chain…"}
          </b>
        </span>
      </p>
    </div>
  );
}
