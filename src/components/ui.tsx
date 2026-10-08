import { Mark } from "@/components/Mark";
import { BRAND } from "@/config/brand";

/** Mark plus the pixel wordmark, as in the header. */
export function Wordmark({ size = 30 }: { size?: number }) {
  return (
    <span className="logo">
      <Mark size={size} className="text-[var(--fg)]" />
      {BRAND.name}
    </span>
  );
}

/** Dashed amber chip on anything that is sample data, not a real launch. */
export function SampleTag({ className = "", children = "sample" }: { className?: string; children?: React.ReactNode }) {
  return <span className={`chip smp ${className}`}>{children}</span>;
}

/** Green chip on anything read from the chain. */
export function ChainTag({ className = "", children = "on chain" }: { className?: string; children?: React.ReactNode }) {
  return <span className={`chip good ${className}`}>{children}</span>;
}

/** Tile colours, taken from the site palette so every lettered logo sits in the same family. */
const ART = [
  ["#c6f24e", "#3d5a0a"],
  ["#5ce1ff", "#0b4a5c"],
  ["#ff4fd8", "#5c0b4c"],
  ["#ffc24d", "#5c3d0b"],
  ["#5ee08a", "#0b5c2a"],
  ["#9cc0ff", "#1b2f6b"],
  ["#ff9a5c", "#6b2c0b"],
  ["#b9a4ff", "#2f1b6b"],
] as const;

/**
 * A token's logo. Only logos the agent pinned (ipfs://<cid>) are shown, through
 * a fixed gateway; anything else falls back to a lettered pixel tile coloured
 * from the ticker.
 */
export function TokenArt({ symbol, logo, size, className = "" }: { symbol: string; logo?: string | null; size?: number; className?: string }) {
  const cid = /^ipfs:\/\/([A-Za-z0-9]{46,100})$/.exec(logo ?? "")?.[1];
  const box = size ? { width: size, height: size } : undefined;
  if (cid) {
    return <img src={`https://ipfs.io/ipfs/${cid}`} alt={`${symbol} logo`} className={`art ${className}`} style={box} />;
  }
  let h = 0;
  for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, deep] = ART[h % ART.length];
  const letters =
    symbol
      .replace(/[^A-Z0-9]/gi, "")
      .slice(0, 2)
      .toUpperCase() || "?";
  const font = size ? Math.max(8, Math.round(size * 0.3)) : undefined;
  return (
    <span className={`art ${className}`} aria-hidden="true" style={{ ...box, fontSize: font, background: `linear-gradient(135deg, ${bg} 0 55%, ${deep} 55%)` }}>
      {letters}
    </span>
  );
}

/** Kept for older call sites: same as TokenArt with a fixed size. */
export function TokenAvatar({ symbol, logo, size = 32 }: { symbol: string; logo?: string | null; size?: number }) {
  return <TokenArt symbol={symbol} logo={logo} size={size} className="rounded-[6px]" />;
}

export function XGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** The ETH glyph, used next to ETH amounts. */
export function EthGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="inline-block shrink-0 align-middle">
      <path d="M12 2.5 5.5 12.6 12 16.4l6.5-3.8L12 2.5Z" fill="currentColor" />
      <path d="M12 17.7 5.5 13.9 12 21.5l6.5-7.6-6.5 3.8Z" fill="currentColor" fillOpacity="0.55" />
    </svg>
  );
}

/** Band heading: kicker, title, optional lede, and an optional element on the right. */
export function BandHead({
  kicker,
  title,
  children,
  aside,
  kickerColor,
  id,
  h1 = false,
}: {
  kicker: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  aside?: React.ReactNode;
  kickerColor?: string;
  id?: string;
  /** The page title: rendered as h1 (styled like every band title). */
  h1?: boolean;
}) {
  const H = h1 ? "h1" : "h2";
  return (
    <div className="band-h">
      <div>
        <div className="kicker" style={kickerColor ? { color: kickerColor } : undefined}>
          {kicker}
        </div>
        <H id={id} className="title">
          {title}
        </H>
        {children ? <p>{children}</p> : null}
      </div>
      {aside}
    </div>
  );
}
