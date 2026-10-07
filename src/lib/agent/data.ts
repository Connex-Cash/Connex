import "server-only";
import { launchesLive } from "@/config/contracts";
import { pairByAddress } from "@/config/pairs";
import { getStore } from "@/lib/store/store";
import { readDevHolds, readLaunches, readMarket, readTokenMeta } from "@/lib/onchain/read";
import { roundNumber, sampleClaims, sampleLaunches, samplePlaybook, sampleRound, sampleSpend } from "./sample.ts";
import type { Claim, Launch, Playbook, Round, SpendDay } from "./types.ts";

/*
 * Where every screen gets its data. Three sources, in order of trust:
 *   chain   - the launcher's records and Pons' markets (once the contracts are deployed)
 *   keeper  - what the agent writes about its own work (rounds, reasoning, playbook, costs)
 *   sample  - invented, clearly tagged, shown only when neither of the above exists
 * The keeper can describe a launch but never create one: a launch is listed
 * only when the launcher contract has a record of it.
 */

const KEEPER_FRESH_MS = 2 * 60 * 60 * 1000;

async function readJson<T>(key: string): Promise<T | null> {
  const store = getStore();
  if (!store) return null;
  try {
    const raw = await store.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function readList<T>(key: string, count: number): Promise<T[]> {
  const store = getStore();
  if (!store) return [];
  try {
    return (await store.range(key, count)).flatMap((raw) => {
      try {
        return [JSON.parse(raw) as T];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export type KeeperStatus = { running: boolean; lastBeat: number | null };

export async function keeperStatus(): Promise<KeeperStatus> {
  const beat = await readJson<{ at: number }>("agent:heartbeat");
  return { running: Boolean(beat && Date.now() - beat.at < KEEPER_FRESH_MS), lastBeat: beat?.at ?? null };
}

/** The round running now (or the one that just finished). */
export async function currentRound(now = Date.now()): Promise<Round> {
  const status = await keeperStatus();
  if (status.running) {
    const live = await readJson<Round>("agent:round:current");
    if (live && live.number >= roundNumber(now) - 1) return { ...live, mode: "live" };
  }
  return sampleRound(roundNumber(now), now);
}

/** Recent finished rounds, newest first. */
export async function recentRounds(count = 12, now = Date.now()): Promise<Round[]> {
  const status = await keeperStatus();
  if (status.running) {
    const list = await readList<Round>("agent:rounds", count);
    if (list.length) return list.map((r) => ({ ...r, mode: "live" as const }));
  }
  const n = roundNumber(now);
  return Array.from({ length: count }, (_, i) => sampleRound(n - 1 - i, now));
}

type LaunchMeta = Partial<Pick<Launch, "description" | "source" | "scores" | "lane" | "tx">> & { logo?: string | null };

async function chainLaunches(): Promise<Launch[]> {
  const records = await readLaunches();
  const newest = records.slice().reverse();
  return Promise.all(
    newest.map(async (r) => {
      const [meta, keeper, market, holds] = await Promise.all([
        readTokenMeta(r.token),
        readJson<LaunchMeta>(`agent:launch:${r.token}`),
        readMarket(r.token).catch(() => null),
        readDevHolds(r.token).catch(() => null),
      ]);
      const pair = pairByAddress(r.pairToken);
      return {
        id: r.token,
        index: r.index,
        mode: "chain" as const,
        name: meta.name,
        symbol: meta.symbol,
        description: keeper?.description ?? "",
        pair: { symbol: pair?.symbol ?? "token", address: /^0x0{40}$/.test(r.pairToken) ? null : r.pairToken },
        launchedAt: r.launchedAt,
        round: r.round,
        lane: keeper?.lane ?? "round",
        source: keeper?.source ?? null,
        scores: keeper?.scores ?? null,
        address: r.token,
        curve: r.curve,
        tx: keeper?.tx ?? null,
        sourceHash: r.sourceHash,
        playbookHash: r.playbookHash,
        market,
        devHolds: holds,
      };
    }),
  );
}

export type LaunchFeed = { mode: "sample" | "chain"; launches: Launch[]; error?: string };

export async function launchFeed(now = Date.now()): Promise<LaunchFeed> {
  if (launchesLive()) {
    try {
      return { mode: "chain", launches: await chainLaunches() };
    } catch {
      return { mode: "chain", launches: [], error: "The chain could not be read just now. Try again in a minute." };
    }
  }
  return { mode: "sample", launches: sampleLaunches(roundNumber(now)) };
}

export async function launchById(id: string, now = Date.now()): Promise<Launch | null> {
  const feed = await launchFeed(now);
  return feed.launches.find((l) => l.id.toLowerCase() === id.toLowerCase()) ?? null;
}

export async function playbook(now = Date.now()): Promise<Playbook> {
  const status = await keeperStatus();
  if (status.running) {
    const live = await readJson<Playbook>("agent:playbook");
    if (live) return { ...live, mode: "live" };
  }
  return samplePlaybook(now);
}

export async function spend(now = Date.now()): Promise<{ mode: "sample" | "live"; days: SpendDay[] }> {
  const status = await keeperStatus();
  if (status.running) {
    const days: SpendDay[] = [];
    for (let d = 6; d >= 0; d--) {
      const day = new Date(now - d * 86_400_000).toISOString().slice(0, 10);
      days.push((await readJson<SpendDay>(`agent:spend:${day}`)) ?? { day, items: [] });
    }
    return { mode: "live", days };
  }
  return { mode: "sample", days: sampleSpend(now) };
}

export async function claims(now = Date.now()): Promise<{ mode: "sample" | "live"; claims: Claim[] }> {
  if (launchesLive()) {
    const status = await keeperStatus();
    return { mode: "live", claims: status.running ? await readList<Claim>("agent:claims", 500) : [] };
  }
  return { mode: "sample", claims: sampleClaims(now) };
}
