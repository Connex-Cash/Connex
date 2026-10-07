/*
 * The assets a CONNEX launch can trade against. Pons V2 keeps an on-chain
 * list of approved pair tokens (approvedPairTokens on the factory); the site
 * re-reads it for every entry below, so a pair Pons drops stops showing as
 * accepted without a code change.
 *
 * Stock tokens are identified by contract, not by ticker: each address below
 * is a proxy to Robinhood's token beacon (0xe10b6f6b…1b00) whose name() ends
 * in "• Robinhood Token" (resolved on chain 19 Sep 2026, re-checked 7 Oct
 * 2026). Dozens of unrelated tokens on the chain reuse these tickers.
 */

export type Pair = { symbol: string; name: string; address: string | null; kind: "native" | "stable" | "stock" };

export const PAIRS: Pair[] = [
  { symbol: "ETH", name: "Ether", address: null, kind: "native" },
  { symbol: "USDG", name: "Global Dollar", address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", kind: "stable" },
  { symbol: "NVDA", name: "NVIDIA", address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC", kind: "stock" },
  { symbol: "AAPL", name: "Apple", address: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9", kind: "stock" },
  { symbol: "TSLA", name: "Tesla", address: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d", kind: "stock" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", address: "0x117cc2133c37B721F49dE2A7a74833232B3B4C0C", kind: "stock" },
  { symbol: "GOOGL", name: "Alphabet Class A", address: "0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3", kind: "stock" },
  { symbol: "MSTR", name: "Strategy Inc.", address: "0xec262a75e413fAfD0dF80480274532C79D42da09", kind: "stock" },
  { symbol: "MU", name: "Micron Technology", address: "0xfF080c8ce2E5feadaCa0Da81314Ae59D232d4afD", kind: "stock" },
  { symbol: "COIN", name: "Coinbase", address: "0x6330D8C3178a418788dF01a47479c0ce7CCF450b", kind: "stock" },
  { symbol: "META", name: "Meta Platforms", address: "0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35", kind: "stock" },
  { symbol: "MSFT", name: "Microsoft", address: "0xe93237C50D904957Cf27E7B1133b510C669c2e74", kind: "stock" },
  { symbol: "AMZN", name: "Amazon", address: "0x12f190a9F9d7D37a250758b26824B97CE941bF54", kind: "stock" },
];

export const pairBySymbol = (s: string) => PAIRS.find((p) => p.symbol === s) ?? null;
export const pairByAddress = (a: string | null) =>
  !a || /^0x0{40}$/i.test(a) ? PAIRS[0] : (PAIRS.find((p) => p.address?.toLowerCase() === a.toLowerCase()) ?? null);
