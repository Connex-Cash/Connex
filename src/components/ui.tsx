import { Mark } from "@/components/Mark";
import { BRAND } from "@/config/brand";

/** Mark plus the expanded wordmark, as in the header. */
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark size={size} />
      <b className="font-display text-[19px] font-extrabold tracking-[0.02em] [font-stretch:125%]">{BRAND.name}</b>
    </span>
  );
}

/** Dashed orange tag on anything that is sample data, not a real launch. */
export function SampleTag({ className = "", children = "sample" }: { className?: string; children?: React.ReactNode }) {
  return <span className={`tag tag-sample ${className}`}>{children}</span>;
}

/** Green tag on anything read from the chain. */
export function ChainTag({ className = "", children = "on chain" }: { className?: string; children?: React.ReactNode }) {
  return <span className={`tag tag-live ${className}`}>{children}</span>;
}

const AVATAR_COLORS = ["#e8441a", "#17150f", "#1d6f45", "#2f4fa8", "#8a3ffc", "#b3300c", "#5b564b", "#0f766e"];

/** A token's logo, or a lettered tile coloured from its ticker when there is none. */
export function TokenAvatar({ symbol, logo, size = 32 }: { symbol: string; logo?: string | null; size?: number }) {
  // Only logos the agent pinned (ipfs://<cid>) are shown, through a fixed gateway; any other URL in the log is ignored.
  const cid = /^ipfs:\/\/([A-Za-z0-9]{46,100})$/.exec(logo ?? "")?.[1];
  const src = cid ? `https://ipfs.io/ipfs/${cid}` : null;
  if (src) {
    return <img src={src} alt={`${symbol} logo`} width={size} height={size} className="ava bg-paper-2 object-cover" style={{ width: size, height: size }} />;
  }
  let h = 0;
  for (const c of symbol) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const bg = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return (
    <span className="ava" style={{ width: size, height: size, background: bg, fontSize: Math.max(9, size * 0.34) }} aria-hidden="true">
      {symbol.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase()}
    </span>
  );
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
