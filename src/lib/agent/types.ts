/*
 * The shapes the agent keeper writes and the site reads. The keeper (keeper/)
 * stores them in Redis under the project prefix; the site never writes them.
 * Sample data (src/lib/agent/sample.ts) uses the same shapes and is always
 * marked mode: "sample".
 */

export const STEP_KEYS = ["research", "check", "name", "draw", "pair", "launch", "announce", "collect", "review"] as const;
export type StepKey = (typeof STEP_KEYS)[number];
export type StepState = "done" | "running" | "waiting" | "skipped" | "failed";

export const STEP_INFO: Record<StepKey, { title: string; budgetMin: number; plain: string }> = {
  research: { title: "Read the trend", budgetMin: 12, plain: "Search X for fast-spreading posts under two hours old, plus the crypto news wire." },
  check: { title: "Skeptical trader check", budgetMin: 4, plain: "Score every candidate as a doubtful trader would. Only a score of 8 out of 10 or higher moves on." },
  name: { title: "Name and ticker", budgetMin: 4, plain: "Write a name, a ticker and a one-paragraph story for the topic that passed." },
  draw: { title: "Draw the logo", budgetMin: 6, plain: "Ask an image model for a fresh mark. No real faces, no brand logos, no text in the image." },
  pair: { title: "Choose the pair", budgetMin: 1, plain: "ETH by default. A stock token only when the company is plainly part of the story." },
  launch: { title: "Launch on Pons", budgetMin: 4, plain: "Create the token through the CONNEX launcher: no opening buy, the treasury as fee recipient." },
  announce: { title: "Announce", budgetMin: 1, plain: "Share the new token on X, contract address included, if posting is enabled." },
  collect: { title: "Collect and split fees", budgetMin: 2, plain: "Sweep creator fees into the treasury, split them, and buy back when the rules allow." },
  review: { title: "Review and rewrite", budgetMin: 3, plain: "Compare how past launches did and rewrite the playbook where the numbers say so." },
};

export type LogLine = { at: number; text: string; tone?: "ok" | "warn" | "info"; tx?: string | null };

export type Candidate = {
  topic: string;
  source: string;
  momentum: number;
  memeability: number;
  originality: number;
  appeal: number;
  score: number;
  passed: boolean;
  note: string;
};

export type RoundToken = {
  name: string;
  symbol: string;
  description: string;
  pair: string;
  pairReason: string;
  logo?: string | null;
  address?: string | null;
  tx?: string | null;
};

export type RoundStep = { key: StepKey; state: StepState; at?: number | null; lines: LogLine[] };

export type Round = {
  id: string;
  number: number;
  startsAt: number;
  mode: "sample" | "live";
  steps: RoundStep[];
  candidates: Candidate[];
  token: RoundToken | null;
  outcome: "running" | "launched" | "skipped" | "failed";
};

export type Market = { phase: number; priceEth: number; mcapEth: number; progress: number; raisedEth: number };

export type DevHolds = { launcher: string; treasury: string; operator: string | null };

export type Launch = {
  id: string;
  index: number;
  mode: "sample" | "chain";
  name: string;
  symbol: string;
  description: string;
  pair: { symbol: string; address: string | null };
  launchedAt: number;
  round: number | null;
  lane: "round" | "breaking";
  source: { label: string; url?: string | null } | null;
  scores: Candidate | null;
  address?: string | null;
  curve?: string | null;
  tx?: string | null;
  sourceHash?: string | null;
  playbookHash?: string | null;
  market?: Market | null;
  devHolds?: DevHolds | null;
  /** Sample only: an illustrative creator-fee figure in ETH, never shown as real. */
  sampleFeesEth?: number;
};

export type PlaybookEntry = { at: number; title: string; change: string; reason: string; evidence: string };

export type Playbook = {
  mode: "sample" | "live";
  version: number;
  updatedAt: number;
  weights: { momentum: number; memeability: number; originality: number; appeal: number };
  gate: number;
  rules: string[];
  naming: string;
  imageStyle: string;
  searches: string[];
  log: PlaybookEntry[];
};

export type SpendItem = { tool: string; kind: "model" | "tool"; calls: number; usd: number };
export type SpendDay = { day: string; items: SpendItem[] };

export type Claim = { at: number; ethWei: string; toBuybackWei: string; toBudgetWei: string; tx?: string | null; tokens?: string[] };
