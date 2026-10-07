// Single place to change project identity. Everything on the site reads from here.
// To publish the real contract address, replace the value of CA below. The
// navbar copy button, the footer, the token page, the swap page and every
// explorer link derive from it. Anything that is not a 0x + 40 hex address is
// treated as "not launched yet".

const CA = "0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
// Pair the chart button opens on DEXTools once the token trades. Leave empty
// until DEXTools lists it.
const CHART_PAIR = "";

export const isAddress = (v: string): v is `0x${string}` =>
  /^0x[0-9a-fA-F]{40}$/.test(v);

export const BRAND = {
  name: "CONNEX",
  ticker: "CONNEX",
  symbol: "$CONNEX",
  domain: "connex.cash",
  url: "https://connex.cash",
  slogan: "AI Launches. Trends Convert. Dev Holds Zero.",
  tagline:
    "Every 30 minutes, AI launches a token from trending topics. Dev holds zero. Earns only from fees.",
  category: "AI launch agent",
  description:
    "CONNEX is an AI launch agent on Robinhood Chain. Every 30 minutes it turns a trending topic into a Pons token, holds none of it, and splits the creator fees 50/50.",
  x: "https://x.com/connex",
  xHandle: "@connex",
  // Public source repository. Kept off the site until the owner publishes it.
  github: "",
  ca: CA,
} as const;

/** True once BRAND.github points at an actual repository. */
export const hasGithub = /^https:\/\/github\.com\/[^/]+\/[^/]+/.test(BRAND.github);
/** True once BRAND.x points at an actual profile. */
export const hasX = /^https:\/\/x\.com\/[A-Za-z0-9_]{1,15}$/.test(BRAND.x);

// Public endpoints are the default. An operator can point the site at a
// private RPC with ROBINHOOD_RPC_URL (server) / NEXT_PUBLIC_ROBINHOOD_RPC_URL
// (browser). Both are optional.
const PUBLIC_RPC = "https://rpc.mainnet.chain.robinhood.com";

export const CHAIN = {
  id: 4663,
  hex: "0x1237",
  name: "Robinhood Chain",
  nativeSymbol: "ETH",
  decimals: 18,
  publicRpc: PUBLIC_RPC,
  rpc: process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL || PUBLIC_RPC,
  /** Second public endpoint, used for reads only when the first one fails. */
  fallbackRpc: "https://robinhood-rpc.publicnode.com",
  explorer: "https://robinhoodchain.blockscout.com",
} as const;

/** Tokens on Robinhood Chain the site reads directly (decimals checked on-chain). */
export const CHAIN_TOKENS = {
  usdg: { address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", symbol: "USDG", decimals: 6 },
  weth: { address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73", symbol: "WETH", decimals: 18 },
} as const;

/** RPC for server code: the private endpoint when set, else the public one. */
export function serverRpc() {
  return (
    process.env.ROBINHOOD_RPC_URL ||
    process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ||
    PUBLIC_RPC
  );
}

export const TOKEN = {
  get isLive() {
    return isAddress(BRAND.ca);
  },
  get explorerUrl() {
    return isAddress(BRAND.ca) ? explorerToken(BRAND.ca) : null;
  },
  get chartUrl() {
    return isAddress(BRAND.ca) && isAddress(CHART_PAIR)
      ? `https://www.dextools.io/app/robinhood/pair-explorer/${CHART_PAIR}`
      : null;
  },
};

/**
 * Pons V2 launchpad and the Uniswap v4 contracts its graduated pools trade on.
 * Every address was checked with eth_getCode on Robinhood Chain mainnet.
 * $CONNEX itself is expected to launch here; the token page swaps through it.
 */
export const PONS = {
  factory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  memeHook: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044",
  v4Quoter: "0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94",
  universalRouter: "0x8876789976dEcBfCbBbe364623C63652db8C0904",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
  /** Public launch page for a token. */
  page: (token: string) => `https://www.ponsfamily.com/launchpad/${token}`,
} as const;

export function explorerAddress(address: string) {
  return `${CHAIN.explorer}/address/${address}`;
}
export function explorerToken(address: string) {
  return `${CHAIN.explorer}/token/${address}`;
}
export function shortAddress(address: string, head = 6, tail = 4) {
  if (address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
