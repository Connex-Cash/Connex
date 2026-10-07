// Spending guards for every paid call (X search, language model, image model, posting).
//   - hourly ceiling on paid calls, retries included (KEEPER_PAID_CALLS_PER_HOUR)
//   - per-round dollar cap (ROUND_USD_CAP): a round that would pass it stops where it is
//   - per-step cooldown after a failure, so a broken API is not hammered
//   - model price ceiling, checked against the live OpenRouter catalogue when a model is
//     configured and again before every call; an unreadable catalogue refuses the call
import { fetchCapped } from "./http.mjs";

export class BudgetError extends Error {}

export class Budget {
  constructor({ paidCallsPerHour, roundUsdCap, stepCooldownSec }, now = () => Date.now()) {
    this.perHour = paidCallsPerHour;
    this.roundCap = roundUsdCap;
    this.cooldownMs = stepCooldownSec * 1000;
    this.now = now;
    this.hour = { key: -1, count: 0 };
    this.roundSpent = 0;
    this.failedAt = new Map();
    this.ledger = new Map(); // tool -> { calls, usd } for today's spend record
  }
  startRound() {
    this.roundSpent = 0;
  }
  /** Call before every paid request, including each retry. Throws when a ceiling would be passed. */
  charge(step, tool, usdEstimate) {
    const h = Math.floor(this.now() / 3_600_000);
    if (this.hour.key !== h) this.hour = { key: h, count: 0 };
    const failed = this.failedAt.get(step);
    if (failed !== undefined && this.now() - failed < this.cooldownMs) throw new BudgetError(`${step} is cooling down after a failure`);
    if (this.hour.count + 1 > this.perHour) throw new BudgetError(`hourly ceiling of ${this.perHour} paid calls reached`);
    if (this.roundSpent + usdEstimate > this.roundCap) throw new BudgetError(`round cap of $${this.roundCap} reached`);
    this.hour.count += 1;
    this.roundSpent += usdEstimate;
    const t = this.ledger.get(tool) ?? { calls: 0, usd: 0 };
    this.ledger.set(tool, { calls: t.calls + 1, usd: t.usd + usdEstimate });
  }
  /** Replaces the estimate with what the call really cost, when the provider reports it. */
  settle(tool, estimate, actual) {
    if (!Number.isFinite(actual)) return;
    this.roundSpent += actual - estimate;
    const t = this.ledger.get(tool);
    if (t) t.usd += actual - estimate;
  }
  fail(step) {
    this.failedAt.set(step, this.now());
  }
  ok(step) {
    this.failedAt.delete(step);
  }
}

export class ModelGate {
  constructor({ openrouterBase, openrouterKey, maxInPerM, maxOutPerM }, fetcher = fetchCapped) {
    this.base = openrouterBase;
    this.key = openrouterKey;
    this.maxIn = maxInPerM;
    this.maxOut = maxOutPerM;
    this.fetcher = fetcher;
    this.catalog = null;
    this.readAt = 0;
  }
  async load() {
    if (this.catalog && Date.now() - this.readAt < 10 * 60_000) return this.catalog;
    try {
      const r = await this.fetcher(`${this.base}/models`, { headers: this.key ? { authorization: `Bearer ${this.key}` } : {} }, { maxBytes: 8_000_000 });
      if (!r.ok) throw new Error(`catalogue ${r.status}`);
      const rows = r.json().data ?? [];
      this.catalog = new Map(rows.map((m) => [m.id, m]));
      this.readAt = Date.now();
    } catch (e) {
      // Fail closed: without prices, nothing may be called.
      this.catalog = null;
      throw new BudgetError(`model catalogue unreadable: ${e.message}`);
    }
    return this.catalog;
  }
  /** Price per 1M tokens in and out; throws when the model is unknown or over the ceiling. */
  async assertAffordable(id, { image = false } = {}) {
    const cat = await this.load();
    const m = cat.get(id);
    if (!m) throw new BudgetError(`model ${id} is not in the catalogue`);
    const inPerM = Number(m.pricing?.prompt ?? NaN) * 1e6;
    const outPerM = Number(m.pricing?.completion ?? NaN) * 1e6;
    if (!Number.isFinite(inPerM) || !Number.isFinite(outPerM)) throw new BudgetError(`model ${id} has no readable price`);
    if (inPerM > this.maxIn || outPerM > this.maxOut) {
      throw new BudgetError(`model ${id} costs $${inPerM.toFixed(2)} in / $${outPerM.toFixed(2)} out per 1M, over the $${this.maxIn} / $${this.maxOut} ceiling`);
    }
    const perImage = Number(m.pricing?.image ?? 0);
    if (image && perImage > 0.05) throw new BudgetError(`image model ${id} costs $${perImage} per image, over $0.05`);
    return { inPerM, outPerM, perImage };
  }
}
