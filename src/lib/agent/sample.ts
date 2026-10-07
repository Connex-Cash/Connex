import { STEP_INFO, STEP_KEYS, type Candidate, type Launch, type LogLine, type Playbook, type Round, type RoundStep, type SpendDay, type Claim } from "./types.ts";

/*
 * Sample data, shown while the agent keeper is not running and the contracts
 * are not deployed. Every topic, name and number here is invented for
 * illustration: no token below exists, nothing has an address, and every
 * screen that shows it carries a "sample" tag. The real feed replaces it as
 * soon as there is something real to show.
 */

export const ROUND_MS = 30 * 60 * 1000;

/** Rounds start on the clock at :00 and :30 UTC. */
export const roundNumber = (now: number) => Math.floor(now / ROUND_MS);
export const roundStart = (n: number) => n * ROUND_MS;
export const roundId = (n: number) => new Date(roundStart(n)).toISOString().slice(0, 16) + "Z";

type Idea = {
  topic: string;
  source: string;
  name: string;
  symbol: string;
  story: string;
  pair: "ETH" | "NVDA" | "AMZN";
  pairReason: string;
  scores: [number, number, number, number];
  rivals: { topic: string; source: string; scores: [number, number, number, number]; note: string }[];
  fees: number;
};

/** Invented topics, written to read like a real round. None of them names a real person or brand. */
const IDEAS: Idea[] = [
  {
    topic: "Pigeons that ride the last train home every night",
    source: "Clip with a fast-climbing repost count, 41 minutes old",
    name: "Night Shift Pigeon",
    symbol: "NSHIFT",
    story: "Clocks out at midnight, takes the last train, never pays the fare. The commuter every city secretly respects.",
    pair: "ETH",
    pairReason: "No company is part of this story, so ETH.",
    scores: [9, 9, 7, 8],
    rivals: [
      { topic: "A sandwich with seventeen layers", source: "Food thread, 2 hours old", scores: [6, 7, 4, 5], note: "Slowing down; done many times before." },
      { topic: "Rain that smells like pencils", source: "Small but lively thread", scores: [5, 6, 8, 4], note: "Cute, but traders would not buy it." },
    ],
    fees: 0.031,
  },
  {
    topic: "A weather radar that keeps drawing a cat",
    source: "Screenshot spreading among forecasters, 25 minutes old",
    name: "Radar Cat",
    symbol: "RADCAT",
    story: "Every storm this week has landed on the map in the shape of a cat. Meteorologists have stopped arguing about it.",
    pair: "ETH",
    pairReason: "ETH: the story has no listed company in it.",
    scores: [8, 10, 8, 9],
    rivals: [{ topic: "Desk plants that outlived three offices", source: "Office humour thread", scores: [6, 7, 6, 6], note: "Below the 8/10 bar." }],
    fees: 0.084,
  },
  {
    topic: "Graphics cards wearing tiny knitted scarves for winter",
    source: "Photo set from a hobby forum, reposted widely in the last hour",
    name: "Cozy Silicon",
    symbol: "COZYGPU",
    story: "Someone knitted scarves for their graphics cards and now the whole timeline wants one. Warm chips, warm hearts.",
    pair: "NVDA",
    pairReason: "The joke is about graphics chips; a trader gets the NVDA pairing instantly.",
    scores: [8, 9, 8, 8],
    rivals: [{ topic: "Laptop stickers older than their owners", source: "Nostalgia thread", scores: [5, 6, 5, 5], note: "Slow and familiar." }],
    fees: 0.022,
  },
  {
    topic: "A snail that won a one-metre race after three hours",
    source: "Village fair video, steady climb all afternoon",
    name: "Three Hour Snail",
    symbol: "SLOWWIN",
    story: "Started last, finished first, took three hours. Patience was never a weakness.",
    pair: "ETH",
    pairReason: "ETH by default.",
    scores: [7, 9, 7, 8],
    rivals: [],
    fees: 0.012,
  },
  {
    topic: "Electric scooters lined up in a row like ducklings",
    source: "Street photo, 52 minutes old, high save rate",
    name: "Scooter Ducklings",
    symbol: "QUACKRD",
    story: "Seven scooters, one behind the other, waiting to cross the road. Nobody knows who parked them.",
    pair: "ETH",
    pairReason: "Scooters are not one company's story, so ETH.",
    scores: [8, 8, 7, 8],
    rivals: [{ topic: "A goose guarding a parking lot", source: "Local news clip", scores: [8, 8, 6, 7], note: "Close second; appeal 7 fell under the bar." }],
    fees: 0.009,
  },
  {
    topic: "A robot vacuum stuck circling the same rug for forty minutes",
    source: "Livestream clip with comments pouring in",
    name: "Rug Loop",
    symbol: "RUGLOOP",
    story: "Forty minutes, one rug, zero progress. Some journeys are about the loop, not the destination.",
    pair: "ETH",
    pairReason: "ETH by default.",
    scores: [9, 9, 6, 8],
    rivals: [],
    fees: 0.046,
  },
  {
    topic: "A frog choir that only sings when it rains",
    source: "Audio clip, rising fast in the evening",
    name: "Rain Choir",
    symbol: "CROAK",
    story: "No rain, no concert. Tickets sold out the moment the clouds rolled in.",
    pair: "ETH",
    pairReason: "ETH by default.",
    scores: [8, 8, 7, 8],
    rivals: [],
    fees: 0.004,
  },
  {
    topic: "A warehouse cat that rides the parcel belt all day",
    source: "Shift-worker video, 30 minutes old",
    name: "Belt Cat",
    symbol: "BELTCAT",
    story: "Clocked in, sat on a box, rode the belt for eight hours. Employee of the month, every month.",
    pair: "AMZN",
    pairReason: "Parcels and warehouses are the story; the pairing is obvious to a trader.",
    scores: [8, 9, 7, 8],
    rivals: [],
    fees: 0.019,
  },
];

/** Some rounds are skipped: nothing reached 8/10. */
const skipped = (n: number) => n % 7 === 3;
const ideaFor = (n: number) => IDEAS[((n % IDEAS.length) + IDEAS.length) % IDEAS.length];

const weighted = (s: [number, number, number, number]) => Math.round((s[0] * 0.35 + s[1] * 0.3 + s[2] * 0.2 + s[3] * 0.15) * 10) / 10;

function candidates(idea: Idea, n: number): Candidate[] {
  const top: Candidate = {
    topic: idea.topic,
    source: idea.source,
    momentum: idea.scores[0],
    memeability: idea.scores[1],
    originality: idea.scores[2],
    appeal: idea.scores[3],
    score: weighted(idea.scores),
    passed: !skipped(n) && idea.scores[3] >= 8,
    note: skipped(n) ? "Investor check said 7/10 this time: traders would scroll past." : "Highest weighted score that cleared the trader check.",
  };
  if (skipped(n)) top.appeal = 7;
  const rest = idea.rivals.map((r) => ({
    topic: r.topic,
    source: r.source,
    momentum: r.scores[0],
    memeability: r.scores[1],
    originality: r.scores[2],
    appeal: r.scores[3],
    score: weighted(r.scores),
    passed: false,
    note: r.note,
  }));
  return [top, ...rest];
}

const mins = (m: number) => m * 60 * 1000;

/** A sample round as it would read `elapsed` ms after it started. */
export function sampleRound(n: number, now: number): Round {
  const start = roundStart(n);
  const elapsed = Math.max(0, now - start);
  const idea = ideaFor(n);
  const skip = skipped(n);
  // How far a typical round has got: one step every ~40 seconds, review last.
  const offsets = [0, 2.2, 3.1, 3.8, 5.0, 5.2, 5.9, 6.2, 6.8];
  const steps: RoundStep[] = STEP_KEYS.map((key, i) => {
    const at = start + mins(offsets[i]);
    const next = i + 1 < offsets.length ? start + mins(offsets[i + 1]) : start + mins(8);
    const blockedBySkip = skip && i >= 2 && i <= 6;
    let state: RoundStep["state"] = now >= next ? "done" : now >= at ? "running" : "waiting";
    if (blockedBySkip && now >= start + mins(offsets[2])) state = "skipped";
    const lines: LogLine[] = [];
    if (state !== "waiting") lines.push(...sampleLines(key, idea, n, at, skip));
    return { key, state, at: state === "waiting" ? null : at, lines };
  });
  const done = elapsed >= mins(8);
  return {
    id: roundId(n),
    number: n,
    startsAt: start,
    mode: "sample",
    steps,
    candidates: now >= start + mins(offsets[1]) ? candidates(idea, n) : [],
    token:
      !skip && now >= start + mins(offsets[3])
        ? { name: idea.name, symbol: idea.symbol, description: idea.story, pair: idea.pair, pairReason: idea.pairReason, logo: null, address: null, tx: null }
        : null,
    outcome: done ? (skip ? "skipped" : "launched") : "running",
  };
}

function sampleLines(key: string, idea: Idea, n: number, at: number, skip: boolean): LogLine[] {
  switch (key) {
    case "research":
      return [
        { at, text: "Searched X for posts under two hours old with unusual repost speed (4 queries).", tone: "info" },
        { at: at + 40_000, text: `Top signal: ${idea.topic.toLowerCase()}.`, tone: "ok" },
      ];
    case "check":
      return skip
        ? [{ at, text: "Best candidate scored 7/10 with the skeptical trader. Round skipped; nothing launches.", tone: "warn" }]
        : [{ at, text: `Trader check passed at ${idea.scores[3]}/10: "${idea.scores[3] >= 9 ? "I would buy this in the first minute." : "Clear joke, easy to share, I would take a small bag."}"`, tone: "ok" }];
    case "name":
      return skip ? [] : [{ at, text: `Named it ${idea.name} ($${idea.symbol}). Name and ticker are not used by any earlier launch.`, tone: "ok" }];
    case "draw":
      return skip ? [] : [{ at, text: "Image model returned a logo; safety check found no faces, brands or text.", tone: "ok" }];
    case "pair":
      return skip ? [] : [{ at, text: `Pair: ${idea.pair}. ${idea.pairReason}`, tone: "ok" }];
    case "launch":
      return skip ? [] : [{ at, text: `Sample only: a live round would launch $${idea.symbol} here through the launcher contract, with no opening buy.`, tone: "info" }];
    case "announce":
      return skip ? [] : [{ at, text: "Announcement drafted. Posting is off in sample mode.", tone: "info" }];
    case "collect":
      return [{ at, text: "Swept creator fees from earlier launches into the treasury and split them 50/50 (sample figures).", tone: "ok" }];
    case "review":
      return [{ at, text: n % 3 === 0 ? "Playbook rule updated: animal topics keep outperforming office humour." : "No playbook change this round: the numbers do not support one yet.", tone: "info" }];
    default:
      return [];
  }
}

/** The last `count` sample launches before round `n`, newest first. */
export function sampleLaunches(n: number, count = 24): Launch[] {
  const out: Launch[] = [];
  let index = 0;
  for (let r = n - 1; out.length < count && r > n - count * 2; r--) {
    if (skipped(r)) continue;
    const idea = ideaFor(r);
    const s = idea.scores;
    out.push({
      id: `s-${r}`,
      index: index++,
      mode: "sample",
      name: idea.name,
      symbol: idea.symbol,
      description: idea.story,
      pair: { symbol: idea.pair, address: null },
      launchedAt: roundStart(r) + mins(5.2),
      round: r,
      lane: r % 5 === 0 ? "breaking" : "round",
      source: { label: idea.source },
      scores: { topic: idea.topic, source: idea.source, momentum: s[0], memeability: s[1], originality: s[2], appeal: s[3], score: weighted(s), passed: true, note: "" },
      sampleFeesEth: Math.round(idea.fees * (1 + ((r * 37) % 11) / 10) * 1000) / 1000,
    });
  }
  return out;
}

export function samplePlaybook(now: number): Playbook {
  const h = 60 * 60 * 1000;
  return {
    mode: "sample",
    version: 14,
    updatedAt: now - 2 * h,
    weights: { momentum: 0.35, memeability: 0.3, originality: 0.2, appeal: 0.15 },
    gate: 8,
    rules: [
      "Prefer topics that a stranger can explain in one sentence.",
      "Animals and everyday objects behaving like people beat office humour.",
      "Skip any topic that is already a token on Pons under a similar name.",
      "A ticker reads best at 5 to 7 letters; avoid digits unless they are the joke.",
      "Pair with a stock token only when the company is the punchline, not a passing mention.",
      "If two candidates tie, take the younger post: speed matters more than size.",
    ],
    naming: "Short, warm, a little absurd. The name says what happened; the ticker is the shout.",
    imageStyle: "Flat shapes, two or three colours, one clear subject, no text, no faces of real people.",
    searches: ["posts under 2h with fast repost growth", "animal clips trending tonight", "everyday objects behaving strangely", "crypto news wire, last 2h"],
    log: [
      {
        at: now - 2 * h,
        title: "Animal topics weighted up",
        change: "Raised memeability weight from 0.28 to 0.30, lowered originality from 0.22 to 0.20.",
        reason: "Over the last 40 sample launches, animal stories earned more creator fees than novel but abstract ideas.",
        evidence: "animal n=17, median fees 0.021 ETH; abstract n=9, median 0.006 ETH (sample figures)",
      },
      {
        at: now - 9 * h,
        title: "Stock pairs only for the punchline",
        change: "Added rule: pair with a stock token only when the company is the joke.",
        reason: "Stock-paired launches where the company was a side detail traded less than ETH pairs.",
        evidence: "stock-pair n=6 median 0.004 ETH vs ETH pair n=31 median 0.015 ETH (sample figures)",
      },
      {
        at: now - 26 * h,
        title: "Younger posts win ties",
        change: "Tie-break changed from engagement size to post age.",
        reason: "Posts under an hour old converted to more first-day volume than bigger, older ones.",
        evidence: "<1h n=22 median 0.017 ETH; 1-2h n=14 median 0.009 ETH (sample figures)",
      },
    ],
  };
}

/** Seven days of illustrative tool and model costs. */
export function sampleSpend(now: number): SpendDay[] {
  const days: SpendDay[] = [];
  for (let d = 6; d >= 0; d--) {
    const day = new Date(now - d * 86_400_000).toISOString().slice(0, 10);
    const f = 0.8 + ((d * 13) % 7) / 10;
    days.push({
      day,
      items: [
        { tool: "Language model (research, check, naming, review)", kind: "model", calls: Math.round(190 * f), usd: Math.round(9.4 * f * 100) / 100 },
        { tool: "X recent search", kind: "tool", calls: Math.round(200 * f), usd: Math.round(6.1 * f * 100) / 100 },
        { tool: "Image model (logos)", kind: "model", calls: Math.round(44 * f), usd: Math.round(1.8 * f * 100) / 100 },
        { tool: "News search", kind: "tool", calls: Math.round(48 * f), usd: Math.round(0.4 * f * 100) / 100 },
      ],
    });
  }
  return days;
}

/** Illustrative fee claims for the current month (sample figures). */
export function sampleClaims(now: number): Claim[] {
  const out: Claim[] = [];
  const d = new Date(now);
  const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  for (let t = first + 3 * 3_600_000; t < now; t += 5 * 3_600_000) {
    const k = Math.floor(t / 3_600_000);
    const wei = BigInt(Math.round((((k * 7919) % 97) + 3) * 1e14));
    out.push({ at: t, ethWei: wei.toString(), toBuybackWei: (wei / 2n).toString(), toBudgetWei: (wei - wei / 2n).toString(), tx: null });
  }
  return out;
}

export const STEP_TITLES = STEP_INFO;
