"use client";

import { useState } from "react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { BRAND, CHAIN, isAddress } from "@/config/brand";
import { CONTRACTS, DEPLOY_DEFAULTS, EXTERNAL, OPERATOR } from "@/config/contracts";
import { CONNEXBUYBACK_BYTECODE, CONNEXLAUNCHER_BYTECODE, CONNEXTREASURY_BYTECODE } from "@/lib/onchain/bytecode";
import { encode_ } from "@/lib/onchain/connex";
import { runSteps, txUrl } from "@/lib/onchain/client";
import { buybackArgs, launcherArgs, treasuryArgs } from "@/lib/onchain/deploy";

/*
 * Owner tool, not linked from the site: deploys the CONNEX contracts from the
 * connected wallet (no key ever touches the site) and prints the lines to
 * paste into src/config/contracts.ts. Removed once the contracts are deployed
 * and their source is verified.
 */

type Result = { address: string; block: number; hash: string };
type Key = "treasury" | "launcher" | "buyback";

function Field({ label, value, onChange, hint, testid }: { label: string; value: string; onChange: (v: string) => void; hint?: string; testid?: string }) {
  return (
    <label className="fld">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value.trim())} className="input font-mono !text-[13px]" data-testid={testid} spellCheck={false} />
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function DeployPanel() {
  const { address, sendTransaction } = useWallet();
  const { open } = useWalletModal();
  const [results, setResults] = useState<Partial<Record<Key, Result>>>({});
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wired, setWired] = useState<{ wire?: string; buyback?: string }>({});

  const [operator, setOperator] = useState<string>(OPERATOR);
  const [treasury, setTreasury] = useState<string>(CONTRACTS.treasury);
  const [launcher, setLauncher] = useState<string>(CONTRACTS.launcher);
  const [token, setToken] = useState<string>(isAddress(BRAND.ca) ? BRAND.ca : "");
  const [buyback, setBuyback] = useState<string>(CONTRACTS.buyback);

  const treasuryAddr = results.treasury?.address ?? treasury;
  const launcherAddr = results.launcher?.address ?? launcher;
  const buybackAddr = results.buyback?.address ?? buyback;
  const d = DEPLOY_DEFAULTS;

  const deploy = async (key: Key, build: () => string, label: string) => {
    if (!address) return open();
    setError(null);
    try {
      const data = build();
      const { receipt, hashes } = await runSteps([{ to: "", data, label }], address, (tx) => sendTransaction({ data: tx.data }), setStage);
      if (!receipt.contractAddress) throw new Error("The receipt has no contract address.");
      setResults((r) => ({ ...r, [key]: { address: receipt.contractAddress!, block: Number(BigInt(receipt.blockNumber)), hash: hashes[0] } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Deployment failed.");
    } finally {
      setStage(null);
    }
  };

  const call = async (which: "wire" | "buyback") => {
    if (!address) return open();
    setError(null);
    try {
      const data = which === "wire" ? encode_.wire(launcherAddr) : encode_.setBuyback(buybackAddr);
      const { hashes } = await runSteps([{ to: treasuryAddr, data, label: which === "wire" ? "Wire launcher" : "Set buyback" }], address, sendTransaction, setStage);
      setWired((w) => ({ ...w, [which]: hashes[0] }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The call failed.");
    } finally {
      setStage(null);
    }
  };

  const button = (k: string, ok: boolean, onClick: () => void, label: string) =>
    !address ? (
      <button type="button" onClick={open} className="btn btn-ink w-fit">
        Connect wallet
      </button>
    ) : (
      <button type="button" disabled={!ok || Boolean(stage)} onClick={onClick} className="btn btn-ink w-fit" data-testid={`deploy-${k}`}>
        {stage ?? label}
      </button>
    );

  const done = (k: Key) =>
    results[k] ? (
      <p className="m-0 font-mono text-[12.5px] break-all text-go" data-testid={`deployed-${k}`}>
        {results[k]!.address} · block {results[k]!.block} ·{" "}
        <a href={txUrl(results[k]!.hash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
          tx <ArrowUpRight size={11} />
        </a>
      </p>
    ) : null;

  const snippet = [
    `export const CONTRACTS = {`,
    `  treasury: "${treasuryAddr}",`,
    `  launcher: "${launcherAddr}",`,
    `  buyback: "${buybackAddr}",`,
    `  launcherBlock: ${results.launcher?.block ?? CONTRACTS.launcherBlock},`,
    `} as const;`,
    ``,
    `export const OPERATOR = "${operator}";`,
  ].join("\n");

  return (
    <div className="grid gap-5">
      <div className="page-h">
        <p className="m-0 font-mono text-[12px] text-ink-4">Owner tool · not linked from the site · noindex</p>
        <h1>Deploy the {BRAND.name} contracts</h1>
        <p>
          Each contract is deployed by your connected wallet on {CHAIN.name}. None has an owner: every value is fixed for good once deployed. Use the same
          wallet for all steps; only the treasury&apos;s deployer can do the two one-time wiring calls.
        </p>
      </div>

      <section className="panel grid gap-4 p-5">
        <h2 className="m-0 text-[22px]">00 · Agent wallet (operator)</h2>
        <Field
          label="Operator address"
          value={operator}
          onChange={setOperator}
          testid="deploy-operator"
          hint="The keeper's hot wallet (keeper/make-key.mjs prints it). It is fixed in both the treasury and the launcher, so it cannot be changed later."
        />
      </section>

      <section className="panel grid gap-4 p-5">
        <h2 className="m-0 text-[22px]">01 · ConnexTreasury</h2>
        <dl className="rows">
          <div>
            <dt>Pons factory · fee escrow</dt>
            <dd>
              {EXTERNAL.ponsFactory.slice(0, 10)}… · {EXTERNAL.ponsFeeEscrow.slice(0, 10)}…
            </dd>
          </div>
          <div>
            <dt>SwapRouter02 · WETH</dt>
            <dd>
              {EXTERNAL.swapRouter02.slice(0, 10)}… · {EXTERNAL.weth.slice(0, 10)}…
            </dd>
          </div>
          <div>
            <dt>Buyback share</dt>
            <dd>{d.buybackShareBps / 100}%</dd>
          </div>
          <div>
            <dt>Per-launch allowance · budget ceiling</dt>
            <dd>
              {Number(d.opsAllowanceWei) / 1e18} ETH · {Number(d.budgetCeilingWei) / 1e18} ETH
            </dd>
          </div>
          <div>
            <dt>Max buyback · interval · fallback</dt>
            <dd>
              {Number(d.maxBuybackPerCallWei) / 1e18} ETH · {d.minBuybackIntervalSec / 3600} h · {d.fallbackAfterSec / 86400} d
            </dd>
          </div>
        </dl>
        {button("treasury", isAddress(operator), () => deploy("treasury", () => CONNEXTREASURY_BYTECODE + treasuryArgs({ operator, ...d }), "Deploy ConnexTreasury"), "Deploy ConnexTreasury")}
        {done("treasury")}
      </section>

      <section className="panel grid gap-4 p-5">
        <h2 className="m-0 text-[22px]">02 · ConnexLauncher</h2>
        <Field label="ConnexTreasury" value={treasuryAddr} onChange={setTreasury} testid="deploy-launcher-treasury" />
        <p className="m-0 text-[13px] text-ink-2">Minimum gap between launches: {d.launcherMinIntervalSec / 60} minutes.</p>
        {button(
          "launcher",
          isAddress(operator) && isAddress(treasuryAddr),
          () => deploy("launcher", () => CONNEXLAUNCHER_BYTECODE + launcherArgs({ treasury: treasuryAddr, operator, minIntervalSec: d.launcherMinIntervalSec }), "Deploy ConnexLauncher"),
          "Deploy ConnexLauncher",
        )}
        {done("launcher")}
      </section>

      <section className="panel grid gap-4 p-5">
        <h2 className="m-0 text-[22px]">03 · Wire the launcher into the treasury (once)</h2>
        <Field label="ConnexLauncher" value={launcherAddr} onChange={setLauncher} testid="deploy-wire-launcher" />
        <button type="button" className="btn w-fit" disabled={!address || !isAddress(treasuryAddr) || !isAddress(launcherAddr) || Boolean(stage)} onClick={() => call("wire")} data-testid="deploy-wire">
          treasury.wire(launcher)
        </button>
        {wired.wire ? (
          <a href={txUrl(wired.wire)} target="_blank" rel="noreferrer" className="text-[12.5px] text-go underline" data-testid="wired-wire">
            Launcher wired. View transaction
          </a>
        ) : null}
      </section>

      <section className="panel grid gap-4 p-5">
        <h2 className="m-0 text-[22px]">04 · ConnexBuyback (after {BRAND.symbol} exists)</h2>
        <Field label={`${BRAND.symbol} token (an ETH-paired Pons launch)`} value={token} onChange={setToken} testid="deploy-buyback-token" />
        {button("buyback", isAddress(token) && isAddress(treasuryAddr), () => deploy("buyback", () => CONNEXBUYBACK_BYTECODE + buybackArgs({ treasury: treasuryAddr, token }), "Deploy ConnexBuyback"), "Deploy ConnexBuyback")}
        {done("buyback")}
        <Field label="ConnexBuyback (to set)" value={buybackAddr} onChange={setBuyback} />
        <button type="button" className="btn w-fit" disabled={!address || !isAddress(treasuryAddr) || !isAddress(buybackAddr) || Boolean(stage)} onClick={() => call("buyback")} data-testid="deploy-setbuyback">
          treasury.setBuyback(buyback) (once)
        </button>
        {wired.buyback ? (
          <a href={txUrl(wired.buyback)} target="_blank" rel="noreferrer" className="text-[12.5px] text-go underline">
            Buyback set. View transaction
          </a>
        ) : null}
      </section>

      {error ? <p className="m-0 text-[13px] break-words text-down" data-testid="deploy-error">{error}</p> : null}

      <section className="panel grid gap-3 p-5">
        <h3 className="m-0 text-[17px]">Paste into src/config/contracts.ts</h3>
        <pre className="m-0 overflow-x-auto rounded bg-paper-2 p-3 font-mono text-[12px]" data-testid="deploy-snippet">
          {snippet}
        </pre>
        <p className="m-0 text-[12.5px] text-ink-2">
          Then check each address with <span className="font-mono">npm run verify-deployment -- &lt;address&gt; &lt;tx&gt;</span> and verify the source on
          Blockscout (see README).
        </p>
      </section>
    </div>
  );
}
