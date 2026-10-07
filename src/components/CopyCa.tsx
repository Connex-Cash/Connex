"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { BRAND, CHAIN, TOKEN, explorerToken, shortAddress } from "@/config/brand";

export function useCopyCa() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  // Until the contract is published there is nothing worth copying.
  const live = TOKEN.isLive;
  const copy = async () => {
    if (!live) return;
    try {
      await navigator.clipboard.writeText(BRAND.ca);
    } catch {
      // Older browsers and some embedded views refuse the async clipboard.
      const area = document.createElement("textarea");
      area.value = BRAND.ca;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };
  return { copied, copy, live };
}

/**
 * Navbar copy chip: "$ASTRUE 0x12…abcd"; on phones a short "CA". One tap
 * copies the full address. Disabled ("at launch") until a real CA is set in
 * src/config/brand.ts.
 */
export function CopyCaTag({ className = "" }: { className?: string }) {
  const { copied, copy, live } = useCopyCa();
  return (
    <button
      type="button"
      onClick={copy}
      disabled={!live}
      title={live ? `Copy ${BRAND.ca}` : "The contract address is published at launch"}
      aria-label={live ? "Copy contract address" : "Contract address not published yet"}
      data-testid="ca-tag"
      className={`btn btn-sm num shrink-0 gap-1.5 font-normal disabled:opacity-100 disabled:cursor-default max-[560px]:px-2 ${className}`}
    >
      <span className="font-medium lg:hidden">CA</span>
      <span className="hidden font-medium lg:inline">{BRAND.symbol}</span>
      <span className="hidden text-ink-2 xl:inline">{!live ? "at launch" : copied ? "copied" : shortAddress(BRAND.ca, 4, 4)}</span>
      {!live ? null : copied ? <Check size={12} className="text-go" weight="bold" /> : <Copy size={12} className="text-ink-2" />}
    </button>
  );
}

/** One line under the hero: "$ASTRUE 0x…(full) [copy]", wrapping on phones. */
export function CopyCaInline({ className = "" }: { className?: string }) {
  const { copied, copy, live } = useCopyCa();
  return (
    <div className={`ca ${className}`}>
      <b>{BRAND.symbol}</b>
      {live ? (
        <a href={explorerToken(BRAND.ca)} target="_blank" rel="noreferrer" data-testid="ca-inline">
          {BRAND.ca}
        </a>
      ) : (
        <span className="addr" data-testid="ca-inline">
          contract address coming soon
        </span>
      )}
      <button type="button" onClick={copy} disabled={!live} aria-label={live ? "Copy contract address" : "Contract address not published yet"}>
        {!live ? "at launch" : copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

/** Footer line: ticker, the whole address and a copy button. */
export function CopyCaFoot() {
  const { copied, copy, live } = useCopyCa();
  return (
    <span className="ca">
      <b>{BRAND.symbol}</b>
      {live ? (
        <a href={explorerToken(BRAND.ca)} target="_blank" rel="noreferrer" data-testid="ca-foot">
          {BRAND.ca}
        </a>
      ) : (
        <span className="addr" data-testid="ca-foot">
          address at launch
        </span>
      )}
      <button type="button" onClick={copy} disabled={!live} aria-label={live ? "Copy contract address" : "Contract address not published yet"} data-testid="ca-copy">
        {!live ? "soon" : copied ? "copied" : "copy"}
      </button>
    </span>
  );
}

/** Full contract block: chain, the whole address and a copy button. */
export function CopyCaBlock({ className = "" }: { className?: string }) {
  const { copied, copy, live } = useCopyCa();
  return (
    <div className={`panel grid gap-2 p-4 ${className}`}>
      <p className="m-0 text-[13px] text-ink-2">
        {BRAND.symbol} contract on {CHAIN.name}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <code className={`num min-w-0 flex-1 text-[13px] leading-snug ${live ? "break-all" : "break-words"}`} data-testid="ca-full">
          {live ? BRAND.ca : "Published at launch. Only trust the address shown on this site."}
        </code>
        <button type="button" onClick={copy} disabled={!live} className="btn btn-sm shrink-0" data-testid="ca-copy">
          {copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
          {!live ? "Not live yet" : copied ? "Copied" : "Copy CA"}
        </button>
      </div>
    </div>
  );
}
