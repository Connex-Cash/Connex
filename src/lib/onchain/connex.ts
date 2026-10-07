import { address, readAddress, readWord, word } from "../abi.ts";

/*
 * Calldata, results and revert reasons for the CONNEX contracts, without a
 * library. Shared by the browser (/deploy) and the server (chain reads).
 * Selectors and topics are keccak256 of the signatures beside them; the test
 * in connex.test.ts checks every one of them.
 */

export const SEL = {
  // ConnexLauncher
  launchCount: "27cca59f", // launchCount()
  launchesPage: "a4154fe9", // launchesPage(uint256,uint256)
  isLaunch: "744b1bc1", // isLaunch(address)
  lastLaunchAt: "8b9566a6", // lastLaunchAt()
  minInterval: "3fb19a53", // minInterval()
  operator: "570ca735", // operator()
  treasury: "61d027b3", // treasury()
  // ConnexTreasury
  wire: "f6487d8c", // wire(address)
  setBuyback: "f3856e76", // setBuyback(address)
  launcher: "16eebd1e", // launcher()
  buyback: "f8ec6911", // buyback()
  buybackReserve: "ff909560", // buybackReserve()
  launchBudget: "885dd18f", // launchBudget()
  unsplitEth: "2a527203", // unsplitEth()
  lastBuybackAt: "cba3f458", // lastBuybackAt()
  buybackShareBps: "b1ccb4ac", // buybackShareBps()
  totalEthIn: "76776b9f", // totalEthIn()
  totalLaunchFees: "f3c13740", // totalLaunchFees()
  totalOpsPaid: "671ef959", // totalOpsPaid()
  totalBoughtBack: "72920a6e", // totalBoughtBack()
  totalBurned: "d89135cd", // totalBurned()
  totalRolledOver: "6eb560ea", // totalRolledOver()
  deployer: "d5f39488", // deployer()
  // ConnexBuyback
  token: "fc0c546a", // token()
  // ERC-20, Pons
  balanceOf: "70a08231", // balanceOf(address)
  name: "06fdde03", // name()
  symbol: "95d89b41", // symbol()
  approvedPairTokens: "9831705e", // approvedPairTokens(address)
  escrowBalanceOf: "70a08231", // balanceOf(address) on the Pons fee escrow
} as const;

export const TOPIC = {
  launched: "0xc4640a0012af59c02e44689c9bc959e1b60aa7ac8ee68508e989e7a6621920d6", // Launched(uint256,address,address,address,uint32,bytes32,bytes32,uint256,bool)
  ethSplit: "0x8510ec3c3a531529671ee6863361108a2802d563ecaaf54ad4a0359015065f1b", // EthSplit(uint256,uint256,uint256,uint256)
  buybackExecuted: "0xd16284cabd3906775696982d49ed11c240a606337054ff78863772640902465b", // BuybackExecuted(address,uint256,uint256,bool)
  launchFunded: "0xb0bbe57962d98ed68586b41b5b49bac3a0a6b3b69f2e8f0c12757255e5b4fc5d", // LaunchFunded(uint256,uint256)
} as const;

const call0 = (sel: string) => `0x${sel}`;
const call1 = (sel: string, a: string) => `0x${sel}${address(a)}`;

export const encode_ = {
  launchCount: () => call0(SEL.launchCount),
  launchesPage: (offset: number, limit: number) => `0x${SEL.launchesPage}${word(offset)}${word(limit)}`,
  isLaunch: (token: string) => call1(SEL.isLaunch, token),
  wire: (launcher: string) => call1(SEL.wire, launcher),
  setBuyback: (sink: string) => call1(SEL.setBuyback, sink),
  balanceOf: (who: string) => call1(SEL.balanceOf, who),
  approvedPairTokens: (token: string) => call1(SEL.approvedPairTokens, token),
  view: (sel: keyof typeof SEL) => call0(SEL[sel]),
};

export type ChainLaunch = {
  index: number;
  token: string;
  curve: string;
  pairToken: string;
  launchedAt: number;
  round: number;
  sourceHash: string;
  playbookHash: string;
};

const hex32 = (v: bigint) => `0x${v.toString(16).padStart(64, "0")}`;

/** launchesPage(...) → Launch[] (a dynamic array of 7-word static structs). */
export function decodeLaunches(result: string, offset: number): ChainLaunch[] {
  const n = Number(readWord(result, 1));
  const out: ChainLaunch[] = [];
  for (let i = 0; i < n; i++) {
    const b = 2 + i * 7;
    out.push({
      index: offset + i,
      token: readAddress(result, b).toLowerCase(),
      curve: readAddress(result, b + 1).toLowerCase(),
      pairToken: readAddress(result, b + 2).toLowerCase(),
      launchedAt: Number(readWord(result, b + 3)) * 1000,
      round: Number(readWord(result, b + 4)),
      sourceHash: hex32(readWord(result, b + 5)),
      playbookHash: hex32(readWord(result, b + 6)),
    });
  }
  return out;
}

/** ABI string result (name(), symbol()). */
export function decodeString(result: string) {
  const data = result.startsWith("0x") ? result.slice(2) : result;
  if (data.length < 128) return "";
  const len = Number(readWord(data, 1));
  const body = data.slice(128, 128 + len * 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  return new TextDecoder().decode(out);
}

export type Log = { address: string; topics: string[]; data: string; blockNumber: string; transactionHash: string; logIndex?: string };

/** Readable reasons for reverts from the CONNEX contracts, by selector. */
export const REVERTS: Record<string, string> = {
  "0x8b906c97": "Only the wallet that deployed the treasury can do this.",
  "0xa741a045": "This wiring step was already done; it can only happen once.",
  "0xd92e233d": "One of the addresses is empty.",
  "0xf899e668": "That launcher points at a different treasury.",
  "0xe160f591": "That buyback contract points at a different treasury.",
  "0x019af637": "One of the values is out of range.",
};

export function revertReason(data: string | null | undefined) {
  if (!data || data.length < 10) return null;
  return REVERTS[data.slice(0, 10).toLowerCase()] ?? null;
}

/** Wei to a JS number of ETH, for display only. */
export const weiToEth = (wei: bigint) => Number(wei) / 1e18;
