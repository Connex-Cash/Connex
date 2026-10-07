// CONNEX agent keeper. Off unless KEEPER_ENABLED=1. Dry run (simulate, never send) unless KEEPER_DRY_RUN=0.
//   rounds at :00 and :30 UTC; fee collection every COLLECT_EVERY_SEC (default 300)
import { parseAbi } from "viem";
import { Budget, ModelGate } from "./budget.mjs";
import { makeChain } from "./chain.mjs";
import { collectFees, sampleQuote } from "./collect.mjs";
import { describe, loadConfig } from "./config.mjs";
import { DEFAULT_PLAYBOOK, copyOf } from "./playbook.mjs";
import { runRound } from "./round.mjs";
import { makeServices } from "./services.mjs";
import { makeStore } from "./store.mjs";

const ROUND_MS = 30 * 60 * 1000;
const cfg = loadConfig();
// Secrets never reach the log: the RPC URL (often carries a key), API keys and tokens are masked.
const SECRETS = [cfg.rpcUrl, cfg.xBearer, cfg.openrouterKey, cfg.pinataJwt, cfg.redisToken, cfg.xUserToken].filter((v) => v && v.length > 8);
const redact = (v) => SECRETS.reduce((t, s) => t.split(s).join("[redacted]"), typeof v === "string" ? v : v instanceof Error ? v.message : JSON.stringify(v));
const log = (...a) => console.log(new Date().toISOString(), ...a.map(redact));
log("connex keeper", JSON.stringify(describe(cfg)));
if (!cfg.enabled) {
  log("KEEPER_ENABLED is not 1: not configured yet, idling.");
  setInterval(() => {}, 1 << 30);
} else {
  const budget = new Budget(cfg);
  const gate = new ModelGate(cfg);
  const store = makeStore(cfg);
  const chain = makeChain(cfg);
  const services = makeServices(cfg, budget, gate);
  const playbook = (await store.get("agent:playbook").catch(() => null)) ?? copyOf(DEFAULT_PLAYBOOK);
  const usedNames = new Set();
  if (cfg.chainReady) {
    const ERC20 = parseAbi(["function name() view returns (string)", "function symbol() view returns (string)"]);
    for (const l of await chain.launches().catch(() => [])) {
      const [n, s] = await Promise.all([chain.pub.readContract({ address: l.token, abi: ERC20, functionName: "name" }).catch(() => ""), chain.pub.readContract({ address: l.token, abi: ERC20, functionName: "symbol" }).catch(() => "")]);
      if (n) usedNames.add(n.toLowerCase());
      if (s) usedNames.add(s.toUpperCase());
    }
    log("agent wallet", chain.address());
  }
  // Models are checked against the price ceiling once at start (and again before every call).
  for (const m of [cfg.textModel, cfg.judgeModel]) await gate.assertAffordable(m).catch((e) => log("model refused:", e.message));
  const ctx = { cfg, budget, gate, store, chain, services, playbook, usedNames, log, redact };

  let busy = false;
  let lastRound = Math.floor(Date.now() / ROUND_MS) - 1;
  const tick = async () => {
    await store.put("agent:heartbeat", { at: Date.now() }, 86_400).catch(() => {});
    const n = Math.floor(Date.now() / ROUND_MS);
    if (busy || n === lastRound) return;
    busy = true;
    lastRound = n;
    try {
      // Pick up a version the owner approved or rolled back since the last round.
      const stored = await store.get("agent:playbook").catch(() => null);
      if (stored && stored.version > playbook.version) Object.assign(playbook, stored);
      const r = await runRound(ctx, n);
      log("round", r.id, r.outcome, r.token?.symbol ?? "");
    } catch (e) {
      log("round crashed", e.message);
    } finally {
      busy = false;
    }
  };
  const collect = async () => {
    if (busy || !cfg.chainReady) return;
    busy = true;
    try {
      await collectFees({ cfg, chain, store, log });
    } catch (e) {
      log("collect failed", e.shortMessage ?? e.message);
    } finally {
      busy = false;
    }
  };
  // Reference quotes for buybacks at random moments, 2 to 13 minutes apart.
  const sampleLater = () =>
    setTimeout(async () => {
      if (cfg.chainReady) await sampleQuote({ chain, store }).catch(() => {});
      sampleLater();
    }, 120_000 + Math.floor(Math.random() * 660_000));
  sampleLater();
  setInterval(tick, 15_000);
  setInterval(collect, cfg.collectEverySec * 1000);
  tick();
}
