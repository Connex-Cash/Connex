// Proves that a deployed address runs exactly this repository's build with the expected
// constructor values, and checks the contracts it points to the same way.
//
//   (cd contracts && ./setup.sh && forge build)
//   npm run verify-deployment -- <address> [deployment tx] [--kind ConnexTreasury]
//        [--operator 0x..] [--treasury 0x..] [--launcher 0x..] [--token 0x..]
//
// Expected values come from src/config/contracts.ts (CONTRACTS, OPERATOR, DEPLOY_DEFAULTS,
// EXTERNAL) and the CA in src/config/brand.ts; the flags override them.
//
// 1. Kind: --kind, or the one built contract whose runtime code equals the deployed code
//    at every byte that is not a constructor-set immutable.
// 2. Every immutable is read back through its getter and compared with the expected value.
//    Nothing from the deployed code is copied into what it is compared against.
// 3. With the deployment tx: the creation input must be the built creation code followed by
//    exactly the expected ABI-encoded constructor arguments; the tx must have succeeded and
//    created this address.
// 4. Addresses the contract points to (launcher, treasury, buyback) are checked the same way.
// Prints OK/FAIL per field; exits 1 on any FAIL. RPC: ROBINHOOD_RPC_URL, else public endpoints.
import { readFileSync, existsSync } from "node:fs";

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i];
  else positional.push(argv[i]);
}
const [target, txHash] = positional;
const isAddr = (v) => /^0x[0-9a-fA-F]{40}$/.test(v ?? "");
if (!isAddr(target)) {
  console.log("Usage: npm run verify-deployment -- <address> [deployment tx] [--kind Name] [--operator 0x..] [--treasury 0x..] [--launcher 0x..] [--token 0x..]");
  process.exit(2);
}

const { CONTRACTS, OPERATOR, DEPLOY_DEFAULTS, EXTERNAL } = await import("../src/config/contracts.ts");
const { treasuryArgs, launcherArgs, buybackArgs } = await import("../src/lib/onchain/deploy.ts");
const brandSrc = readFileSync(new URL("../src/config/brand.ts", import.meta.url), "utf8");
const brandCa = /const CA = "(0x[0-9a-fA-F]{40})"/.exec(brandSrc)?.[1] ?? "";

const pick = (flag, fallback) => (flags[flag] ?? fallback ?? "").toLowerCase();
const EXPECT = {
  operator: pick("operator", OPERATOR),
  treasury: pick("treasury", CONTRACTS.treasury),
  launcher: pick("launcher", CONTRACTS.launcher),
  buyback: pick("buyback", CONTRACTS.buyback),
  token: pick("token", brandCa),
};

const RPCS = [process.env.ROBINHOOD_RPC_URL, "https://rpc.mainnet.chain.robinhood.com", "https://robinhood.drpc.org", "https://robinhood-rpc.publicnode.com"].filter(Boolean);
async function rpc(method, params) {
  let last;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const body = await res.json();
      if (body.error) throw new Error(body.error.message);
      return body.result;
    } catch (e) {
      last = e;
    }
  }
  throw last;
}
const word = (hex) => BigInt(`0x${hex.slice(2, 66) || "0"}`);
const asAddr = (hex) => `0x${hex.slice(-40)}`.toLowerCase();

let failures = 0;
const ok = (label, detail = "") => console.log(`  OK    ${label}${detail ? ` ${detail}` : ""}`);
const bad = (label, detail = "") => {
  failures++;
  console.log(`  FAIL  ${label}${detail ? ` ${detail}` : ""}`);
};
const same = (label, got, want) => (want === "" || want === undefined ? bad(label, `${got} (no expected value: set it in src/config or pass a flag)`) : String(got).toLowerCase() === String(want).toLowerCase() ? ok(label, String(got)) : bad(label, `${got}, expected ${want}`));

const NAMES = ["ConnexTreasury", "ConnexLauncher", "ConnexBuyback"];
const ART = Object.fromEntries(
  NAMES.map((name) => {
    const file = new URL(`../contracts/out/${name}.sol/${name}.json`, import.meta.url);
    if (!existsSync(file)) {
      console.log(`contracts/out has no ${name}: run (cd contracts && ./setup.sh && forge build) first.`);
      process.exit(2);
    }
    return [name, JSON.parse(readFileSync(file, "utf8"))];
  }),
);

/** Code with immutable slots zeroed on both sides: only the compiled code itself is compared. */
function codeMatches(onchain, json) {
  const built = json.deployedBytecode.object.toLowerCase();
  if (built.length !== onchain.length) return false;
  const a = built.slice(2).split("");
  const b = onchain.slice(2).split("");
  for (const list of Object.values(json.deployedBytecode.immutableReferences ?? {})) {
    for (const { start, length } of list) {
      for (let i = start * 2; i < (start + length) * 2; i++) {
        a[i] = "0";
        b[i] = "0";
      }
    }
  }
  return a.join("") === b.join("");
}

const D = DEPLOY_DEFAULTS;
const low = (v) => v.toLowerCase();
const GETTERS = {
  ConnexTreasury: [
    ["factory", "0xc45a0155", asAddr, () => low(EXTERNAL.ponsFactory)],
    ["escrow", "0xe2fdcc17", asAddr, () => low(EXTERNAL.ponsFeeEscrow)],
    ["swapRouter", "0xc31c9c07", asAddr, () => low(EXTERNAL.swapRouter02)],
    ["weth", "0x3fc8cef3", asAddr, () => low(EXTERNAL.weth)],
    ["operator", "0x570ca735", asAddr, () => EXPECT.operator],
    ["buybackShareBps", "0xb1ccb4ac", word, () => BigInt(D.buybackShareBps)],
    ["opsAllowance", "0x5115c2f9", word, () => BigInt(D.opsAllowanceWei)],
    ["budgetCeiling", "0x37278650", word, () => BigInt(D.budgetCeilingWei)],
    ["maxBuybackPerCall", "0xc0685a30", word, () => BigInt(D.maxBuybackPerCallWei)],
    ["minBuybackInterval", "0xcb2e419f", word, () => BigInt(D.minBuybackIntervalSec)],
    ["fallbackAfter", "0x08faf59c", word, () => BigInt(D.fallbackAfterSec)],
  ],
  ConnexLauncher: [
    ["factory", "0xc45a0155", asAddr, () => low(EXTERNAL.ponsFactory)],
    ["treasury", "0x61d027b3", asAddr, () => EXPECT.treasury],
    ["operator", "0x570ca735", asAddr, () => EXPECT.operator],
    ["minInterval", "0x3fb19a53", word, () => BigInt(D.launcherMinIntervalSec)],
  ],
  ConnexBuyback: [
    ["factory", "0xc45a0155", asAddr, () => low(EXTERNAL.ponsFactory)],
    ["poolManager", "0xdc4c90d3", asAddr, () => low(EXTERNAL.poolManager)],
    ["treasury", "0x61d027b3", asAddr, () => EXPECT.treasury],
    ["token", "0xfc0c546a", asAddr, () => EXPECT.token],
  ],
};

/** The constructor arguments this contract should have been created with. */
function expectedArgs(kind) {
  if (kind === "ConnexTreasury") return treasuryArgs({ operator: EXPECT.operator, ...D });
  if (kind === "ConnexLauncher") return launcherArgs({ treasury: EXPECT.treasury, operator: EXPECT.operator, minIntervalSec: D.launcherMinIntervalSec });
  return buybackArgs({ treasury: EXPECT.treasury, token: EXPECT.token });
}

const visited = new Set();
async function verify(address, kindHint, tx) {
  const key = address.toLowerCase();
  if (visited.has(key)) return;
  visited.add(key);
  console.log(`\n${address}${kindHint ? ` (${kindHint})` : ""}`);
  const code = (await rpc("eth_getCode", [address, "latest"])).toLowerCase();
  if (!code || code === "0x") return bad("code", "none at this address");
  const kinds = kindHint ? [kindHint] : NAMES;
  const kind = kinds.find((n) => ART[n] && codeMatches(code, ART[n]));
  if (!kind) return bad("code", kindHint ? `does not match ${kindHint} as built here` : `matches none of ${NAMES.join(", ")} as built here`);
  ok("code", `is ${kind} from this build (immutables aside)`);

  for (const [label, sel, decode, want] of GETTERS[kind]) {
    const got = decode(await rpc("eth_call", [{ to: address, data: sel }, "latest"]));
    const expected = want();
    if (typeof got !== "bigint") same(label, got, expected);
    else if (got === expected) ok(label, String(got));
    else bad(label, `${got}, expected ${expected}`);
  }

  if (tx) {
    const [t, receipt] = await Promise.all([rpc("eth_getTransactionByHash", [tx]), rpc("eth_getTransactionReceipt", [tx])]);
    if (!t || !receipt) bad("deployment tx", "not found");
    else {
      if (t.to === null) ok("deployment tx", "is a contract creation");
      else bad("deployment tx", "is not a contract creation");
      if (receipt.status === "0x1") ok("deployment status", "success");
      else bad("deployment status", receipt.status);
      same("created address", receipt.contractAddress, address);
      let args = null;
      try {
        args = expectedArgs(kind);
      } catch (e) {
        bad("constructor args", e.message);
      }
      if (args !== null) {
        const want = (ART[kind].bytecode.object + args).toLowerCase();
        if (t.input.toLowerCase() === want) ok("creation input", "= this build + the expected constructor arguments");
        else bad("creation input", t.input.toLowerCase().startsWith(ART[kind].bytecode.object.toLowerCase()) ? "built code matches, constructor arguments differ" : "differs from this build");
      }
    }
  }

  // Follow what this contract points to.
  if (kind === "ConnexTreasury") {
    const launcher = asAddr(await rpc("eth_call", [{ to: address, data: "0x16eebd1e" }, "latest"]));
    if (/^0x0{40}$/.test(launcher)) bad("treasury.launcher", "not wired yet: call wire(launcher) from the deployer");
    else {
      same("treasury.launcher", launcher, EXPECT.launcher);
      await verify(launcher, "ConnexLauncher");
    }
    const sink = asAddr(await rpc("eth_call", [{ to: address, data: "0xf8ec6911" }, "latest"]));
    if (/^0x0{40}$/.test(sink)) console.log("  --    treasury.buyback not set yet (expected before the CA)");
    else {
      same("treasury.buyback", sink, EXPECT.buyback);
      await verify(sink, "ConnexBuyback");
    }
  }
  if ((kind === "ConnexLauncher" || kind === "ConnexBuyback") && isAddr(EXPECT.treasury)) await verify(EXPECT.treasury, "ConnexTreasury");
}

await verify(target, flags.kind, txHash);
console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
