import { ChainTag, SampleTag } from "@/components/ui";
import { CHAIN } from "@/config/brand";
import { CONTRACTS, DEPLOY_DEFAULTS, launchesLive } from "@/config/contracts";
import type { TreasuryState } from "@/lib/onchain/read";
import { eth, utc } from "@/lib/format";

const pct = DEPLOY_DEFAULTS.buybackShareBps / 100;

/** The fee split as a bar: buyback side and launch side. */
export function FeeSplit() {
  return (
    <div className="grid gap-3">
      <div className="split" role="img" aria-label={`${pct}% buys back $CONNEX, ${100 - pct}% pays for the next launches`}>
        <span style={{ width: `${pct}%` }} className="bg-signal text-white">
          {pct}%<span className="hidden sm:inline">&nbsp;buy back $CONNEX</span>
          <span className="sm:hidden">&nbsp;buyback</span>
        </span>
        <span style={{ width: `${100 - pct}%` }} className="bg-card">
          {100 - pct}%<span className="hidden sm:inline">&nbsp;next launches</span>
          <span className="sm:hidden">&nbsp;launches</span>
        </span>
      </div>
      <p className="m-0 text-[13px] text-ink-2">
        Fixed in the treasury contract when it is deployed. No one can change the split afterwards: the contract has no owner and no setter.
      </p>
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

export function TreasuryPanel({ state, ethUsd }: { state: TreasuryState | null; ethUsd: number | null }) {
  const usdOf = (wei: bigint) => (ethUsd ? ` ≈ $${((Number(wei) / 1e18) * ethUsd).toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "");
  if (!launchesLive() || !state) {
    const d = DEPLOY_DEFAULTS;
    return (
      <div className="panel grid gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="m-0 text-[20px]">Treasury</h3>
          <span className="tag">not deployed yet</span>
        </div>
        <p className="m-0 text-[14px] text-ink-2">
          The treasury contract is written and tested but not on {CHAIN.name} yet, so there is nothing to read. Once it is deployed, this panel shows its
          live balances. These are the values it is set to be deployed with:
        </p>
        <dl className="rows">
          <Row k="Buyback share" v={`${d.buybackShareBps / 100}% of every fee`} />
          <Row k="Paid per launch to the agent" v={`${eth(d.opsAllowanceWei)} ETH`} hint="Gas and tools, from the launch side only" />
          <Row k="Launch side ceiling" v={`${eth(d.budgetCeilingWei)} ETH`} hint="Anything above rolls over to the buyback side" />
          <Row k="Largest single buyback" v={`${eth(d.maxBuybackPerCallWei)} ETH`} />
          <Row k="Time between buybacks" v={`${d.minBuybackIntervalSec / 3600} h`} />
        </dl>
      </div>
    );
  }
  return (
    <div className="panel grid gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-[20px]">Treasury</h3>
        <ChainTag>read {utc(state.readAt)}</ChainTag>
      </div>
      <dl className="rows">
        <Row k="Saved for $CONNEX buybacks" v={`${eth(state.buybackReserve)} ETH${usdOf(state.buybackReserve)}`} />
        <Row k="Budget for the next launches" v={`${eth(state.launchBudget)} ETH${usdOf(state.launchBudget)}`} />
        <Row k="Waiting in the Pons fee escrow" v={`${eth(state.pendingInEscrow)} ETH`} hint="Claimed on the next collect" />
        <Row k="Fees received, all time" v={`${eth(state.totalIn)} ETH`} />
        <Row k="Spent on Pons launch fees" v={`${eth(state.launchFees)} ETH`} />
        <Row k="Paid to the agent for gas and tools" v={`${eth(state.opsPaid)} ETH`} />
        <Row k="Spent on buybacks" v={`${eth(state.boughtBack)} ETH`} />
        <Row k="$CONNEX burned" v={(Number(state.burned) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 })} />
        {state.operatorBalance !== null ? <Row k="Agent wallet gas balance" v={`${eth(state.operatorBalance)} ETH`} /> : null}
      </dl>
      <a className="tlink text-[13px]" href={`${CHAIN.explorer}/address/${CONTRACTS.treasury}`} target="_blank" rel="noreferrer">
        Treasury on Blockscout
      </a>
    </div>
  );
}

export function SampleBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="note m-0 flex flex-wrap items-center gap-2">
      <SampleTag />
      <span>{children}</span>
    </p>
  );
}
