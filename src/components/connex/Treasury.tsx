import Link from "next/link";
import { ChainTag } from "@/components/ui";
import { BRAND, CHAIN, TOKEN } from "@/config/brand";
import { CONTRACTS, DEPLOY_DEFAULTS, launchesLive } from "@/config/contracts";
import type { TreasuryState } from "@/lib/onchain/read";
import { eth, utc } from "@/lib/format";

const pct = DEPLOY_DEFAULTS.buybackShareBps / 100;
const usdOf = (wei: bigint, ethUsd: number | null) =>
  ethUsd ? `$${((Number(wei) / 1e18) * ethUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `${eth(wei)} ETH`;

/** The money panel on the home page: split bar, held-back note, the two sides and three fixed rules. */
export function SplitPanel({ state, ethUsd }: { state: TreasuryState | null; ethUsd: number | null }) {
  const live = launchesLive() && state;
  return (
    <div className="panel split">
      <h3>Where each creator fee goes</h3>
      <div className="split-bar" role="img" aria-label={`${pct}% buys back ${BRAND.symbol}, ${100 - pct}% pays for the next launches`}>
        <div className="a" style={{ width: `${pct}%` }}>
          {pct}% buyback
        </div>
        <div className="b">{100 - pct}% next launches</div>
      </div>
      {!TOKEN.isLive ? (
        <div className="hold-note">
          <b>{BRAND.symbol} has not launched.</b> Until it does, the buyback half of each claim waits in the treasury, locked away from launch spending. The
          first {BRAND.symbol} buyback gets all of it at once.
        </div>
      ) : null}
      <div className="split-key">
        <div>
          <b>{live ? usdOf(state.buybackReserve, ethUsd) : "$0"}</b>
          {TOKEN.isLive ? `held for ${BRAND.symbol} buybacks` : `saved for the first ${BRAND.symbol} buyback`}
        </div>
        <div>
          <b>{live ? usdOf(state.launchBudget, ethUsd) : "$0"}</b>
          set aside for the next launches
        </div>
      </div>
      <ul className="laws">
        <li>
          <span className="ic">01</span>
          <div>
            <b>The right pair for each launch</b>
            <span className="d">ETH, unless a stock token is the punchline.</span>
          </div>
          <span className="p">ETH or stock</span>
        </li>
        <li>
          <span className="ic">02</span>
          <div>
            <b>Dev holds zero of every launch</b>
            <span className="d">
              No opening buy, and the contracts cannot hold a launched token. {BRAND.symbol} is separate: see <Link href="/token">Token</Link>.
            </span>
          </div>
          <span className="p">0 tokens</span>
        </li>
        <li>
          <span className="ic">03</span>
          <div>
            <b>Fees are the only income</b>
            <span className="d">A slice of each trade, on the curve and after graduation.</span>
          </div>
          <span className="p">{live ? `${eth(state.totalIn)} ETH in` : "not deployed"}</span>
        </li>
      </ul>
    </div>
  );
}

function Row({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) {
  return (
    <div>
      <dt>
        {k}
        {hint ? <span className="block text-[12px] text-ink-4">{hint}</span> : null}
      </dt>
      <dd>{v}</dd>
    </div>
  );
}

/** Every treasury balance and total, or the values it will be deployed with. */
export function TreasuryPanel({ state, ethUsd }: { state: TreasuryState | null; ethUsd: number | null }) {
  const usd = (wei: bigint) => (ethUsd ? ` ≈ $${((Number(wei) / 1e18) * ethUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "");
  if (!launchesLive() || !state) {
    const d = DEPLOY_DEFAULTS;
    return (
      <div className="panel pad grid content-start gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3>Treasury</h3>
          <span className="chip warn">not deployed yet</span>
        </div>
        <p className="m-0 text-[14px] text-ink-2">
          The treasury contract is written and tested but not on {CHAIN.name} yet, so there is nothing to read. Once deployed, this panel shows its live
          balances. These are the values it will be deployed with:
        </p>
        <dl className="rows">
          <Row k="Buyback share" v={`${d.buybackShareBps / 100}% of every fee`} />
          <Row k="Paid to the agent per launch" v={`${eth(d.opsAllowanceWei)} ETH`} hint="Gas and tools, from the launch side only" />
          <Row k="Launch side ceiling" v={`${eth(d.budgetCeilingWei)} ETH`} hint="Anything above it rolls over to the buyback side" />
          <Row k="Largest single buyback" v={`${eth(d.maxBuybackPerCallWei)} ETH`} />
          <Row k="Time between buybacks" v={`${d.minBuybackIntervalSec / 3600} h`} />
        </dl>
      </div>
    );
  }
  return (
    <div className="panel pad grid content-start gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3>Treasury</h3>
        <ChainTag>read {utc(state.readAt)}</ChainTag>
      </div>
      <dl className="rows">
        <Row k={`Saved for ${BRAND.symbol} buybacks`} v={`${eth(state.buybackReserve)} ETH${usd(state.buybackReserve)}`} />
        <Row k="Budget for the next launches" v={`${eth(state.launchBudget)} ETH${usd(state.launchBudget)}`} />
        <Row k="Waiting in the Pons fee escrow" v={`${eth(state.pendingInEscrow)} ETH`} hint="Claimed on the next collect" />
        <Row k="Fees received, all time" v={`${eth(state.totalIn)} ETH`} />
        <Row k="Spent on Pons launch fees" v={`${eth(state.launchFees)} ETH`} />
        <Row k="Paid to the agent for gas and tools" v={`${eth(state.opsPaid)} ETH`} />
        <Row k="Spent on buybacks" v={`${eth(state.boughtBack)} ETH`} />
        <Row k={`${BRAND.symbol} burned`} v={(Number(state.burned) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 })} />
        {state.operatorBalance !== null ? <Row k="Agent wallet gas balance" v={`${eth(state.operatorBalance)} ETH`} /> : null}
      </dl>
      <a className="more w-fit" href={`${CHAIN.explorer}/address/${CONTRACTS.treasury}`} target="_blank" rel="noreferrer">
        Treasury on Blockscout
      </a>
    </div>
  );
}

/** Amber note above anything that is sample data. */
export function SampleBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="note m-0 flex flex-wrap items-center gap-2">
      <span className="chip smp">sample</span>
      <span>{children}</span>
    </p>
  );
}
