import type { Launch } from "@/lib/agent/types";

/** Plain helpers shared by the launch list (client) and the launch page (server). */

export function devHoldsText(l: Launch): { text: string; ok: boolean | null } {
  if (l.mode === "sample") return { text: "0", ok: null };
  const h = l.devHolds;
  if (!h) return { text: "unread", ok: null };
  const vals = [h.launcher, h.treasury, ...(h.operator ? [h.operator] : [])];
  if (vals.some((v) => v === "unknown")) return { text: "unread", ok: null };
  const total = vals.reduce((a, v) => a + BigInt(v), 0n);
  return total === 0n ? { text: "0", ok: true } : { text: (Number(total) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 0 }), ok: false };
}

export function stageText(l: Launch): string {
  if (!l.market) return "–";
  if (l.market.phase === 0) return `curve ${Math.round(l.market.progress)}%`;
  return l.market.phase === 2 ? "pool" : "graduating";
}

export function mcapUsd(l: Launch, ethUsd: number | null): number | null {
  return l.market && ethUsd ? l.market.mcapEth * ethUsd : null;
}

export function pairKind(symbol: string): "eth" | "stock" | "stable" {
  if (symbol === "ETH") return "eth";
  if (symbol === "USDG") return "stable";
  return "stock";
}

export function laneText(l: Launch): string {
  if (l.lane === "breaking") return "Breaking";
  return l.round !== null ? `Round ${new Date(l.round * 30 * 60 * 1000).toISOString().slice(11, 16)}` : "Round";
}

export function launchNo(l: Launch) {
  return l.mode === "sample" ? `s${l.index + 1}` : `#${l.index + 1}`;
}
