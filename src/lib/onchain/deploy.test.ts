import { test } from "node:test";
import assert from "node:assert/strict";
import { buybackArgs, launcherArgs, treasuryArgs } from "./deploy.ts";
import { DEPLOY_DEFAULTS } from "../../config/contracts.ts";

const OP = "0x00000000000000000000000000000000000000a1";
const T = "0x00000000000000000000000000000000000000b2";

test("treasury args are 11 words in constructor order", () => {
  const hex = treasuryArgs({ operator: OP, ...DEPLOY_DEFAULTS });
  assert.equal(hex.length, 11 * 64);
  assert.equal(hex.slice(4 * 64, 5 * 64), OP.slice(2).padStart(64, "0"));
  assert.equal(BigInt(`0x${hex.slice(5 * 64, 6 * 64)}`), 5000n);
  assert.equal(BigInt(`0x${hex.slice(10 * 64)}`), BigInt(DEPLOY_DEFAULTS.fallbackAfterSec));
});

test("treasury args refuse bad values", () => {
  assert.throws(() => treasuryArgs({ operator: OP, ...DEPLOY_DEFAULTS, buybackShareBps: 10_001 }));
  assert.throws(() => treasuryArgs({ operator: "nope", ...DEPLOY_DEFAULTS }));
  assert.throws(() => treasuryArgs({ operator: OP, ...DEPLOY_DEFAULTS, fallbackAfterSec: 1 }));
});

test("launcher and buyback args", () => {
  assert.equal(launcherArgs({ treasury: T, operator: OP, minIntervalSec: 600 }).length, 4 * 64);
  assert.equal(buybackArgs({ treasury: T, token: OP }).length, 4 * 64);
});
