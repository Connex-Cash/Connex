/*
 * CONNEX contract addresses on Robinhood Chain: the one place to paste them.
 *
 * Empty = not deployed. The site then shows clearly labelled practice
 * rounds and launches, and the treasury panel says "not deployed yet".
 * Once an address is filled in, the same screens read real state from the
 * chain: launches come from the launcher's events, the treasury panel from
 * its balances, and every launch links to its transaction on Blockscout.
 *
 * Deploy order (see /deploy and the README):
 *   1. ConnexTreasury  (no dependency)                       -> before the CA
 *   2. ConnexLauncher  (needs 1)                             -> before the CA
 *   3. treasury.wire(2), once, from the wallet that deployed 1
 *   4. ConnexBuyback   (needs $CONNEX, a Pons ETH launch)    -> after the CA
 *   5. treasury.setBuyback(4), once, from the same wallet
 */

export const CONTRACTS = {
  treasury: "",
  launcher: "",
  buyback: "",
  /** Block the launcher was deployed in: the earliest block worth scanning for its events. */
  launcherBlock: 0,
} as const;

/**
 * The agent's hot wallet: the only address that may call launcher.launch and
 * treasury.executeBuyback / convertToken. It is fixed in both constructors,
 * so it must be known before step 1. Empty until the owner creates it
 * (keeper/make-key.mjs prints the address; the key never leaves the keeper).
 */
export const OPERATOR = "";

/** Constructor values used by /deploy (owner can change them there before deploying). */
export const DEPLOY_DEFAULTS = {
  /** Share of every fee that buys back $CONNEX, basis points (5000 = 50%). */
  buybackShareBps: 5000,
  /** Paid to the operator from the launch side for each launch: gas plus the agent's tools. */
  opsAllowanceWei: "500000000000000", // 0.0005 ETH
  /** Most the launch side may hold; anything above rolls over to the buyback side. */
  budgetCeilingWei: "500000000000000000", // 0.5 ETH
  /** Largest single buyback. */
  maxBuybackPerCallWei: "50000000000000000", // 0.05 ETH
  /** Minimum seconds between two buybacks. */
  minBuybackIntervalSec: 3600,
  /** Seconds without an operator buyback after which anyone may run one (bounded the same way). */
  fallbackAfterSec: 7 * 24 * 3600,
  /** Minimum seconds between two launches (the agent runs every 30 minutes; this leaves room for retries). */
  launcherMinIntervalSec: 600,
} as const;

/** Robinhood Chain contracts the CONNEX contracts are built against (checked with eth_getCode / eth_call, 7 Oct 2026). */
export const EXTERNAL = {
  ponsFactory: "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e",
  ponsFeeEscrow: "0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e",
  ponsMemeHook: "0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044",
  poolManager: "0x8366a39CC670B4001A1121B8F6A443A643e40951",
  swapRouter02: "0xCaf681a66D020601342297493863E78C959E5cb2",
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
} as const;

const isAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

/** The treasury and launcher are what make launches and the fee split real. */
export const launchesLive = () => isAddr(CONTRACTS.treasury) && isAddr(CONTRACTS.launcher);
export const buybackLive = () => launchesLive() && isAddr(CONTRACTS.buyback);
export const operatorKnown = () => isAddr(OPERATOR);
export const isTokenId = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);
