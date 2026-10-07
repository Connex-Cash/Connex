import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { BRAND, CHAIN } from "@/config/brand";
import { CONTRACTS, DEPLOY_DEFAULTS, EXTERNAL, OPERATOR } from "@/config/contracts";
import { breadcrumbs, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "Contracts",
  description: `The ${BRAND.name} contracts on ${CHAIN.name}: launcher, treasury and buyback. Functions, events, fixed parameters, deploy order and how to verify them.`,
  path: "/contracts",
});

const d = DEPLOY_DEFAULTS;
const ethOf = (wei: string) => `${Number(wei) / 1e18} ETH`;

type Fn = [string, string];
const SPEC: {
  name: string;
  key: "launcher" | "treasury" | "buyback";
  when: string;
  summary: string;
  params: [string, string][];
  fns: Fn[];
  events: string[];
}[] = [
  {
    name: "ConnexTreasury",
    key: "treasury",
    when: "Deployable now, before the token exists.",
    summary: "Receives every launch's Pons creator fees and splits them between the buyback reserve and the launch budget.",
    params: [
      ["Pons factory, fee escrow", `${EXTERNAL.ponsFactory.slice(0, 10)}…, ${EXTERNAL.ponsFeeEscrow.slice(0, 10)}…`],
      ["Uniswap SwapRouter02, WETH", `${EXTERNAL.swapRouter02.slice(0, 10)}…, ${EXTERNAL.weth.slice(0, 10)}…`],
      ["Operator (agent wallet)", OPERATOR || "set at deploy"],
      ["Buyback share", `${d.buybackShareBps / 100}%`],
      ["Per-launch allowance", ethOf(d.opsAllowanceWei)],
      ["Launch budget ceiling", ethOf(d.budgetCeilingWei)],
      ["Max buyback per call", ethOf(d.maxBuybackPerCallWei)],
      ["Min time between buybacks", `${d.minBuybackIntervalSec / 3600} h`],
      ["Open to anyone after silence", `${d.fallbackAfterSec / 86400} days`],
    ],
    fns: [
      ["collect()", "Claims ETH from the Pons escrow and splits everything unbooked. Anyone."],
      ["collectToken(token)", "Same for fees paid in a pair token (stock or USDG). Anyone."],
      ["sweepCurve(token) / sweepPool(token)", "Moves a CONNEX launch's fees into the escrow, then collects. Anyone."],
      ["fundLaunch(amount)", "Pays the Pons launch fee to the launcher, plus the allowance to the operator. Launcher only."],
      ["executeBuyback(amount, minOut)", "Buys $CONNEX and burns it, within the caps. Operator, or anyone after the silence period."],
      ["convertToken(token, side, amount, fee, minOut)", "Swaps one side's pair-token fees to ETH on that same side. Operator."],
      ["burnStray(token)", "Burns any CONNEX launch token or $CONNEX sent here. Anyone."],
      ["wire(launcher) / setBuyback(sink)", "One-time wiring by the deployer; each can run once."],
    ],
    events: ["EthSplit", "TokenSplit", "LaunchFunded", "BuybackExecuted", "TokenConverted", "CurveSwept", "PoolSwept", "StrayBurned", "Wired", "BuybackSet"],
  },
  {
    name: "ConnexLauncher",
    key: "launcher",
    when: "Deployable now; needs the treasury address.",
    summary: "The only way the agent launches. Creates each token on Pons with no opening buy and the treasury as fee recipient, and can never move a launched token.",
    params: [
      ["Pons factory", `${EXTERNAL.ponsFactory.slice(0, 10)}…`],
      ["Treasury", CONTRACTS.treasury || "from step 1"],
      ["Operator (agent wallet)", OPERATOR || "set at deploy"],
      ["Min time between launches", `${d.launcherMinIntervalSec / 60} min`],
    ],
    fns: [
      ["launch(params)", "Creates a token on Pons; pays the fee itself or from the treasury budget. Operator only."],
      ["burnStray(token)", "Burns anything sent to the launcher. Anyone."],
      ["launchCount() / launchesPage(offset, limit) / isLaunch(token)", "The public record of every launch."],
    ],
    events: ["Launched", "StrayBurned"],
  },
  {
    name: "ConnexBuyback",
    key: "buyback",
    when: "After $CONNEX exists (an ETH-paired Pons launch).",
    summary: "Buys $CONNEX on its Pons curve or Uniswap v4 pool with ETH from the treasury and sends every token straight to the burn address.",
    params: [
      ["Pons factory, v4 PoolManager", `${EXTERNAL.ponsFactory.slice(0, 10)}…, ${EXTERNAL.poolManager.slice(0, 10)}…`],
      ["Treasury", CONTRACTS.treasury || "from step 1"],
      ["$CONNEX", "the token address, once it exists"],
    ],
    fns: [["buyAndBurn(minOut)", "Treasury only. Refunds unspent ETH to the treasury."]],
    events: ["Burned"],
  },
];

export default function ContractsPage() {
  return (
    <main className="wrap">
      <JsonLd data={breadcrumbs([{ name: "Contracts", path: "/contracts" }])} />
      <div className="page-h">
        <h1>Contracts</h1>
        <p>
          Three small contracts carry the parts of {BRAND.name} that should not depend on trust. None has an owner, an admin key, a proxy or a fee setter;
          every number below is fixed when the contract is deployed. Source code, tests and the deploy tool live in the project repository.
        </p>
      </div>
      <div className="grid gap-12 pt-8">
        <section aria-labelledby="order-h" className="grid gap-4">
          <h2 id="order-h" className="m-0 text-[26px]">
            Status and deploy order
          </h2>
          <ol className="steps">
            {[
              ["ConnexTreasury", CONTRACTS.treasury, "before the token"],
              ["ConnexLauncher", CONTRACTS.launcher, "before the token"],
              ["treasury.wire(launcher)", "", "once, by the treasury deployer"],
              ["ConnexBuyback", CONTRACTS.buyback, "after $CONNEX exists"],
              ["treasury.setBuyback(buyback)", "", "once, by the treasury deployer"],
            ].map(([n, addr, when], i) => (
              <li key={n}>
                <span className="n">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <h3 className="num !font-mono !text-[16px]">{n}</h3>
                  <p className="num text-[13px] break-all">
                    {addr ? (
                      <a className="tlink" href={`${CHAIN.explorer}/address/${addr}`} target="_blank" rel="noreferrer">
                        {addr}
                      </a>
                    ) : i === 2 || i === 4 ? (
                      "wiring step"
                    ) : (
                      "not deployed yet"
                    )}
                  </p>
                </div>
                <span className="t">{when}</span>
              </li>
            ))}
          </ol>
        </section>
        {SPEC.map((c) => (
          <section key={c.name} aria-labelledby={`${c.key}-h`} className="grid grid-cols-1 gap-8 border-t-2 border-ink pt-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="grid content-start gap-3">
              <h2 id={`${c.key}-h`} className="m-0 font-mono text-[24px] [font-stretch:100%]">
                {c.name}
              </h2>
              <p className="m-0 text-ink-2">{c.summary}</p>
              <p className="m-0 text-[13px]">
                <span className="tag">{CONTRACTS[c.key] ? "deployed" : "not deployed"}</span> {c.when}
              </p>
              <dl className="rows">
                {c.params.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="grid content-start gap-4">
              <h3 className="m-0 text-[18px]">Functions</h3>
              <dl className="rows">
                {c.fns.map(([k, v]) => (
                  <div key={k} className="!grid !justify-start">
                    <dt className="font-mono !text-ink">{k}</dt>
                    <dd className="!font-sans !text-left !text-ink-2">{v}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="m-0 text-[18px]">Events</h3>
              <p className="m-0 font-mono text-[13px] text-ink-2">{c.events.join(" · ")}</p>
            </div>
          </section>
        ))}
        <section aria-labelledby="verify-h" className="doc">
          <h2 id="verify-h" className="!mt-0">
            Verifying a deployment
          </h2>
          <ol>
            <li>
              Build the contracts (<code>forge build</code> in <code>contracts/</code>, solc 0.8.26, via-IR, optimizer 200 runs, EVM cancun).
            </li>
            <li>
              Run <code>npm run verify-deployment -- &lt;address&gt; &lt;deploy tx&gt;</code>: it checks the creation transaction, the runtime code and every
              constructor value against this build and exits with an error on any mismatch.
            </li>
            <li>Match the source on Blockscout with the same compiler settings, then the explorer shows the code next to the address.</li>
          </ol>
          <p>
            The tests run against mocks and against a fork of {CHAIN.name} mainnet: real Pons launches through the launcher, real curve trades, fees swept into
            the treasury, a stock-paired launch whose NVDA fees are swapped to ETH on Uniswap, graduation, and buybacks on both the curve and the v4 pool.
          </p>
        </section>
      </div>
    </main>
  );
}
