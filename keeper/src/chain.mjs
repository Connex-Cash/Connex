// Robinhood Chain side of the agent: launch through the launcher, sweep and collect fees,
// convert pair-token fees, buy back $CONNEX. The key is read from a file and never logged.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, defineChain, http, parseAbi, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const LAUNCHER_ABI = parseAbi([
  "function launch((string name,string symbol,string logo,string description,string website,string twitter,address pairToken,uint256 launchConfigId,bytes32 expectedEconomics,uint32 round,bytes32 sourceHash,bytes32 playbookHash) p) payable returns (address token, address curve)",
  "function launchCount() view returns (uint256)",
  "function launchesPage(uint256 offset, uint256 limit) view returns ((address token,address curve,address pairToken,uint40 launchedAt,uint32 round,bytes32 sourceHash,bytes32 playbookHash)[])",
  "function nextLaunchIn() view returns (uint256)",
  "event Launched(uint256 indexed index, address indexed token, address curve, address pairToken, uint32 round, bytes32 sourceHash, bytes32 playbookHash, uint256 launchFee, bool feeFromTreasury)",
]);
export const TREASURY_ABI = parseAbi([
  "function collect() returns (uint256)",
  "function collectToken(address token) returns (uint256)",
  "function sweepCurve(address token) returns (uint256)",
  "function sweepPool(address token) returns (uint256)",
  "function executeBuyback(uint256 amount, uint256 minTokensOut) returns (uint256 spent, uint256 burned)",
  "function convertToken(address token, bool buybackSide, uint256 amountIn, uint24 poolFee, uint256 minEthOut) returns (uint256)",
  "function buybackReserve() view returns (uint256)",
  "function launchBudget() view returns (uint256)",
  "function tokenBuyback(address) view returns (uint256)",
  "function tokenBudget(address) view returns (uint256)",
  "function buyback() view returns (address)",
  "function maxBuybackPerCall() view returns (uint256)",
  "function buybackOpensIn(address) view returns (uint256)",
  "event EthSplit(uint256 amount, uint256 toBuyback, uint256 toBudget, uint256 rolledOver)",
]);
const SINK_ABI = parseAbi(["function buyAndBurn(uint256 minTokensOut) payable returns (uint256 spent, uint256 burned)"]);
const FACTORY_ABI = parseAbi(["function launchFee() view returns (uint256)", "function previewLaunchEconomics(uint256 launchConfigId, address pairToken) view returns (bytes32)"]);
const ESCROW_ABI = parseAbi(["function balanceOf(address) view returns (uint256)", "function balanceOfToken(address,address) view returns (uint256)"]);
const PONS_FACTORY = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const PONS_ESCROW = "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e";

export function makeChain(cfg) {
  const chain = defineChain({ id: cfg.chainId, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [cfg.rpcUrl] } } });
  const pub = createPublicClient({ chain, transport: http(cfg.rpcUrl, { timeout: 20_000 }) });
  let wallet = null;
  let account = null;
  const loadKey = () => {
    if (account) return;
    const key = readFileSync(cfg.keyFile, "utf8").trim();
    account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
    wallet = createWalletClient({ account, chain, transport: http(cfg.rpcUrl, { timeout: 30_000 }) });
  };

  async function write(address, abi, functionName, args = [], value = 0n) {
    loadKey();
    // Dry run first: a revert is reported in words and costs nothing.
    const { request } = await pub.simulateContract({ account, address, abi, functionName, args, value });
    if (cfg.dryRun) return { dryRun: true, hash: null, result: (await pub.simulateContract({ account, address, abi, functionName, args, value })).result };
    const hash = await wallet.writeContract(request);
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
    if (receipt.status !== "success") throw new Error(`${functionName} reverted in ${hash}`);
    return { hash, receipt };
  }

  return {
    pub,
    address: () => {
      loadKey();
      return account.address;
    },
    gasBalance: async () => {
      loadKey();
      return pub.getBalance({ address: account.address });
    },
    launchFee: () => pub.readContract({ address: PONS_FACTORY, abi: FACTORY_ABI, functionName: "launchFee" }),
    economics: (pair) => pub.readContract({ address: PONS_FACTORY, abi: FACTORY_ABI, functionName: "previewLaunchEconomics", args: [0n, pair] }),
    nextLaunchIn: () => pub.readContract({ address: cfg.launcher, abi: LAUNCHER_ABI, functionName: "nextLaunchIn" }),
    launches: async () => {
      const n = await pub.readContract({ address: cfg.launcher, abi: LAUNCHER_ABI, functionName: "launchCount" });
      const start = n > 200n ? n - 200n : 0n;
      return n === 0n ? [] : pub.readContract({ address: cfg.launcher, abi: LAUNCHER_ABI, functionName: "launchesPage", args: [start, 200n] });
    },
    async launch(p, { payFromTreasury }) {
      const economics = await this.economics(p.pairToken);
      const fee = payFromTreasury ? 0n : await this.launchFee();
      return write(cfg.launcher, LAUNCHER_ABI, "launch", [{ ...p, launchConfigId: 0n, expectedEconomics: economics }], fee);
    },
    treasuryRead: (fn, args = []) => pub.readContract({ address: cfg.treasury, abi: TREASURY_ABI, functionName: fn, args }),
    escrowPending: () => pub.readContract({ address: PONS_ESCROW, abi: ESCROW_ABI, functionName: "balanceOf", args: [cfg.treasury] }),
    sweepCurve: (token) => write(cfg.treasury, TREASURY_ABI, "sweepCurve", [token]),
    sweepPool: (token) => write(cfg.treasury, TREASURY_ABI, "sweepPool", [token]),
    collect: () => write(cfg.treasury, TREASURY_ABI, "collect"),
    /** Tokens a buyback of `amount` would burn right now, simulated as the treasury calling the sink. */
    async quoteSink(sink, amount) {
      const { result } = await pub.simulateContract({ account: cfg.treasury, address: sink, abi: SINK_ABI, functionName: "buyAndBurn", args: [1n], value: amount, gasPrice: 0n });
      return result[1];
    },
    buyback: (amount, minOut) => write(cfg.treasury, TREASURY_ABI, "executeBuyback", [amount, minOut]),
    zeroAddress,
  };
}
