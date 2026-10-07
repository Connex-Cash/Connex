import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUND_MS, roundNumber, sampleLaunches, sampleRound } from "./sample.ts";

test("rounds start on :00 and :30", () => {
  const t = Date.UTC(2026, 9, 8, 10, 47, 12);
  assert.equal(new Date(roundNumber(t) * ROUND_MS).toISOString(), "2026-10-08T10:30:00.000Z");
});

test("a sample round is always tagged and never has an address", () => {
  const n = roundNumber(Date.now());
  for (let i = 0; i < 20; i++) {
    const r = sampleRound(n - i, Date.now());
    assert.equal(r.mode, "sample");
    assert.equal(r.steps.length, 9);
    assert.equal(r.token?.address ?? null, null);
  }
});

test("sample launches have no addresses and zero dev holdings claims", () => {
  for (const l of sampleLaunches(roundNumber(Date.now()))) {
    assert.equal(l.mode, "sample");
    assert.equal(l.address ?? null, null);
  }
});

test("a skipped round launches nothing", () => {
  const n = 7 * 100 + 3; // n % 7 === 3 is a skipped round
  const r = sampleRound(n, (n + 1) * ROUND_MS);
  assert.equal(r.outcome, "skipped");
  assert.equal(r.token, null);
});
