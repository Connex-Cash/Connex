import { test } from "node:test";
import assert from "node:assert/strict";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { SEL, TOPIC, decodeLaunches, decodeString } from "./connex.ts";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const k = (s: string) => hex(keccak_256(new TextEncoder().encode(s)));

const SIGS: Record<keyof typeof SEL, string> = {
  launchCount: "launchCount()",
  launchesPage: "launchesPage(uint256,uint256)",
  isLaunch: "isLaunch(address)",
  lastLaunchAt: "lastLaunchAt()",
  minInterval: "minInterval()",
  operator: "operator()",
  treasury: "treasury()",
  wire: "wire(address)",
  setBuyback: "setBuyback(address)",
  launcher: "launcher()",
  buyback: "buyback()",
  buybackReserve: "buybackReserve()",
  launchBudget: "launchBudget()",
  unsplitEth: "unsplitEth()",
  lastBuybackAt: "lastBuybackAt()",
  buybackShareBps: "buybackShareBps()",
  totalEthIn: "totalEthIn()",
  totalLaunchFees: "totalLaunchFees()",
  totalOpsPaid: "totalOpsPaid()",
  totalBoughtBack: "totalBoughtBack()",
  totalBurned: "totalBurned()",
  totalRolledOver: "totalRolledOver()",
  deployer: "deployer()",
  token: "token()",
  balanceOf: "balanceOf(address)",
  name: "name()",
  symbol: "symbol()",
  approvedPairTokens: "approvedPairTokens(address)",
  escrowBalanceOf: "balanceOf(address)",
};

test("every selector is keccak256 of its signature", () => {
  for (const [key, sig] of Object.entries(SIGS)) {
    assert.equal(SEL[key as keyof typeof SEL], k(sig).slice(0, 8), sig);
  }
});

test("event topics", () => {
  assert.equal(TOPIC.launched, `0x${k("Launched(uint256,address,address,address,uint32,bytes32,bytes32,uint256,bool)")}`);
  assert.equal(TOPIC.ethSplit, `0x${k("EthSplit(uint256,uint256,uint256,uint256)")}`);
  assert.equal(TOPIC.buybackExecuted, `0x${k("BuybackExecuted(address,uint256,uint256,bool)")}`);
  assert.equal(TOPIC.launchFunded, `0x${k("LaunchFunded(uint256,uint256)")}`);
});

test("decodes a launches page", () => {
  const w = (v: bigint | number) => BigInt(v).toString(16).padStart(64, "0");
  const a = (s: string) => s.slice(2).padStart(64, "0");
  const token = "0x00000000000000000000000000000000000000aa";
  const result =
    "0x" + w(32) + w(1) + a(token) + a("0x00000000000000000000000000000000000000bb") + w(0) + w(1_700_000_000) + w(7) + w(1) + w(2);
  const [l] = decodeLaunches(result, 4);
  assert.equal(l.index, 4);
  assert.equal(l.token, token);
  assert.equal(l.pairToken, "0x0000000000000000000000000000000000000000");
  assert.equal(l.launchedAt, 1_700_000_000_000);
  assert.equal(l.round, 7);
});

test("decodes an ABI string", () => {
  const w = (v: number) => v.toString(16).padStart(64, "0");
  const body = Buffer.from("CONNEX").toString("hex").padEnd(64, "0");
  assert.equal(decodeString("0x" + w(32) + w(6) + body), "CONNEX");
});
