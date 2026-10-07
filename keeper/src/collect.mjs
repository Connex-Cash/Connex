// Every five minutes: sweep the curves of CONNEX launches that still trade there, collect,
// and run one bounded buyback when the treasury allows it.
export async function collectFees({ cfg, chain, store, log }) {
  const launches = await chain.launches();
  // Read both sides first: sweepCurve collects on its own, so the delta must span the sweeps too.
  const [r0, b0] = await Promise.all([chain.treasuryRead("buybackReserve"), chain.treasuryRead("launchBudget")]);
  const swept = [];
  for (const l of launches.slice(-60)) {
    try {
      const r = await chain.sweepCurve(l.token);
      swept.push({ token: l.token, tx: r.hash });
    } catch {
      // Graduated or nothing pending: the pool sweep is tried instead (it may need Pons' operator).
      try {
        const r = await chain.sweepPool(l.token);
        swept.push({ token: l.token, tx: r.hash, pool: true });
      } catch {}
    }
  }
  let tx = swept.find((x) => x.tx)?.tx ?? null;
  if ((await chain.escrowPending()) > 0n) tx = (await chain.collect().catch((e) => log("collect failed", e.shortMessage ?? e.message)))?.hash ?? null;
  const [r1, b1] = await Promise.all([chain.treasuryRead("buybackReserve"), chain.treasuryRead("launchBudget")]);
  const dr = r1 - r0;
  const db = b1 - b0;
  if (dr > 0n || db > 0n) await store.push("agent:claims", { at: Date.now(), ethWei: (dr + db).toString(), toBuybackWei: dr.toString(), toBudgetWei: db.toString(), tx }, 500, 400 * 86_400);

  // Buyback: only once $CONNEX exists. See buybackDecision for why the minimum comes from a
  // stored reference and not from the quote of the moment.
  const sink = await chain.treasuryRead("buyback");
  if (sink !== chain.zeroAddress) {
    const reserve = await chain.treasuryRead("buybackReserve");
    const max = await chain.treasuryRead("maxBuybackPerCall");
    const amount = reserve < max ? reserve : max;
    if (amount > 0n) {
      // The fresh quote is never added to the reference: references come only from sampleQuote().
      const quoted = await chain.quoteSink(sink, amount).catch(() => null);
      const history = await store.list("agent:buyback:quotes", 48).catch(() => []);
      const opensIn = await chain.treasuryRead("buybackOpensIn", [chain.address()]);
      const d = buybackDecision({ amount, quoted, history, opensIn, slippageBps: cfg.buybackSlippageBps, random: rand });
      if (d.go) {
        const r = await chain.buyback(amount, d.minOut);
        log("buyback", amount.toString(), "min", d.minOut.toString(), r.hash ?? "dry run");
      } else log("buyback waits:", d.why);
    }
  }
  return swept;
}

const rand = () => Math.random();
const SCALE = 10n ** 18n;
/** Tokens per 1 ETH, as a decimal string (bigints do not survive JSON). */
const perEth = (tokens, wei) => ((tokens * SCALE) / wei).toString();

/**
 * Whether to buy back now, and the minimum to accept.
 * A quote taken in the same moment as the trade is worthless as protection: whoever front-runs
 * the buy moves the price first, and the quote follows. So the floor comes from a reference the
 * attacker cannot move within one block: the median of the keeper's own reference quotes, taken
 * at random moments (at least 3, each 5+ minutes apart, spanning 15+ minutes, last 6 hours). The buy is refused when the fresh
 * quote is worse than that reference by more than the slippage, the minimum is the reference
 * less the slippage, batches stay at the contract cap, and the moment is randomised (one tick
 * in three once the interval is open) so the timing cannot be predicted.
 */
export const MIN_QUOTE_GAP_MS = 5 * 60_000;

/**
 * Picks reference quotes from the last 6 hours, keeping only ones at least MIN_QUOTE_GAP_MS
 * apart (oldest first), so a burst of samples taken within a minute counts once.
 */
export function referenceQuotes(history, now = Date.now()) {
  const past = history.filter((h) => now - h.at < 6 * 3_600_000 && now >= h.at && BigInt(h.perEth) > 0n).sort((a, b) => a.at - b.at);
  const kept = [];
  for (const h of past) if (!kept.length || h.at - kept[kept.length - 1].at >= MIN_QUOTE_GAP_MS) kept.push(h);
  return kept;
}

export function buybackDecision({ amount, quoted, history, opensIn, slippageBps, random, now = Date.now() }) {
  if (opensIn > 0n) return { go: false, why: "interval not open yet" };
  if (quoted === null || quoted === 0n) return { go: false, why: "no quote" };
  const ref = referenceQuotes(history, now);
  const span = ref.length ? ref[ref.length - 1].at - ref[0].at : 0;
  if (ref.length < 3 || span < 15 * 60_000) return { go: false, why: "not enough reference quotes yet" };
  const sorted = ref.map((h) => BigInt(h.perEth)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const median = sorted[Math.floor(sorted.length / 2)];
  const fresh = (quoted * SCALE) / amount;
  const floorPerEth = (median * BigInt(10_000 - slippageBps)) / 10_000n;
  if (fresh < floorPerEth) return { go: false, why: "price is worse than the recent reference: possible manipulation" };
  if (random() > 1 / 3) return { go: false, why: "waiting for a random tick" };
  return { go: true, minOut: (floorPerEth * amount) / SCALE };
}

/**
 * Takes one reference quote. main.mjs calls this at random moments (2 to 13 minutes apart),
 * not on the collect tick, so nobody can hold the price up exactly when the keeper samples.
 */
export async function sampleQuote({ chain, store }) {
  const sink = await chain.treasuryRead("buyback");
  if (sink === chain.zeroAddress) return null;
  const reserve = await chain.treasuryRead("buybackReserve");
  const max = await chain.treasuryRead("maxBuybackPerCall");
  const amount = reserve < max ? reserve : max;
  if (amount === 0n) return null;
  const quoted = await chain.quoteSink(sink, amount);
  const entry = { at: Date.now(), perEth: perEth(quoted, amount) };
  await store.push("agent:buyback:quotes", entry, 48, 7 * 86_400);
  return entry;
}
