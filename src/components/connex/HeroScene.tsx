"use client";

import { useEffect, useRef } from "react";

/*
 * Hero backdrop: the CONNEX mark drawn as a pixel sprite, drifting down the
 * screen on five depth layers (small, dim and slow at the back; large and
 * bright up front), each one slowly turning. Now and then one of them
 * "converts": its lit node flashes and a ring spreads out. Canvas only.
 */

// 13x13 sprite of the mark: two crossing strokes ending in four nodes.
// N = node, S = stroke, H = stroke highlight, L = the lit node.
const SPRITE = [
  ".NNN.....LLL.",
  "NNNNN...LLLLL",
  "NNNSS...SSLLL",
  ".NSSHS.SHSSL.",
  "...SSHSHSS...",
  "....SSHSS....",
  ".....SHS.....",
  "....SSHSS....",
  "...SSHSHSS...",
  ".NSSHS.SHSSN.",
  "NNNSS...SSNNN",
  "NNNNN...NNNNN",
  ".NNN.....NNN.",
];

const PALETTE: Record<string, string> = { N: "#c6f24e", S: "#8fbf2a", H: "#e4ff9a", L: "#ff6a3d" };
const FLASH: Record<string, string> = { ...PALETTE, L: "#ffffff", N: "#e4ff9a" };

function paint(rows: string[], px: number, colors: Record<string, string>) {
  const c = document.createElement("canvas");
  c.width = c.height = rows.length * px;
  const g = c.getContext("2d");
  if (!g) return c;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = colors[ch];
      if (!col) return;
      g.fillStyle = col;
      g.fillRect(x * px, y * px, px, px);
    }),
  );
  return c;
}

type Layer = { px: number; speed: [number, number]; alpha: number; density: number };
const LAYERS: Layer[] = [
  { px: 2, speed: [14, 24], alpha: 0.16, density: 0.000026 },
  { px: 3, speed: [26, 40], alpha: 0.28, density: 0.000015 },
  { px: 4, speed: [44, 64], alpha: 0.48, density: 0.0000075 },
  { px: 6, speed: [70, 100], alpha: 0.78, density: 0.0000027 },
  { px: 8, speed: [100, 140], alpha: 1, density: 0.0000011 },
];

type Drop = { layer: Layer; size: number; x: number; y: number; v: number; phase: number; drift: number; rot: number; spin: number; flashAt: number };

export function HeroScene() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sheets = new Map(LAYERS.map((l) => [l.px, { base: paint(SPRITE, l.px, PALETTE), lit: paint(SPRITE, l.px, FLASH) }]));
    let w = 0;
    let h = 0;
    let drops: Drop[] = [];
    let raf = 0;
    let last = 0;
    let visible = true;

    const spawn = (layer: Layer, anywhere: boolean): Drop => {
      const size = SPRITE.length * layer.px;
      return {
        layer,
        size,
        x: Math.random() * (w + size) - size / 2,
        y: anywhere ? Math.random() * (h + size) - size : -size - Math.random() * h * 0.4,
        v: layer.speed[0] + Math.random() * (layer.speed[1] - layer.speed[0]),
        phase: Math.random() * Math.PI * 2,
        drift: 5 + Math.random() * 12,
        rot: (Math.random() - 0.5) * 0.6,
        spin: (Math.random() - 0.5) * 0.5,
        flashAt: Math.random() * 8,
      };
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      drops = LAYERS.flatMap((l) => Array.from({ length: Math.max(1, Math.round(w * h * l.density)) }, () => spawn(l, true)));
    };

    const draw = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      for (const d of drops) {
        d.y += d.v * dt;
        d.rot += d.spin * dt;
        d.flashAt -= dt;
        if (d.y > h + d.size) Object.assign(d, spawn(d.layer, false));
        const flashing = d.flashAt < 0 && d.flashAt > -0.35;
        if (d.flashAt < -0.35) d.flashAt = 5 + Math.random() * 9;
        const sheet = sheets.get(d.layer.px);
        if (!sheet) continue;
        const x = d.x + Math.sin(t / 1400 + d.phase) * d.drift;
        ctx.save();
        ctx.globalAlpha = d.layer.alpha;
        ctx.translate(x + d.size / 2, d.y + d.size / 2);
        ctx.rotate(d.rot);
        if (d.layer.px >= 6) {
          ctx.shadowColor = "rgba(198,242,78,.55)";
          ctx.shadowBlur = 18;
        }
        ctx.drawImage(flashing ? sheet.lit : sheet.base, -d.size / 2, -d.size / 2);
        if (flashing && d.layer.px >= 4) {
          const k = -d.flashAt / 0.35;
          ctx.globalAlpha = (1 - k) * d.layer.alpha;
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "#c6f24e";
          ctx.lineWidth = d.layer.px / 2;
          ctx.strokeRect(-d.size / 2 - k * d.size * 0.4, -d.size / 2 - k * d.size * 0.4, d.size * (1 + k * 0.8), d.size * (1 + k * 0.8));
        }
        ctx.restore();
      }
      if (!still && visible) raf = requestAnimationFrame(draw);
    };

    resize();
    draw(0);
    if (!still) raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => {
      resize();
      if (still) draw(0);
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      const was = visible;
      visible = entry.isIntersecting;
      if (visible && !was && !still) {
        last = 0;
        raf = requestAnimationFrame(draw);
      }
    });
    io.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" />;
}
