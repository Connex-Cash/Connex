"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Check, CopySimple } from "@phosphor-icons/react";
import { BRAND, TOKEN, explorerToken, shortAddress } from "@/config/brand";

/*
 * The $CONNEX contract address control: a rounded pill with the ticker badge,
 * the shortened address (full address in a tooltip on hover or focus), an
 * explorer link and a round copy button. Copying raises a toast from the
 * bottom of the screen. Until a real address is set in src/config/brand.ts
 * the pill says so and the button stays disabled.
 */

/* ---- Toast: one per page, fed by a tiny store so any pill can raise it ---- */

type Note = { id: number; text: string; detail?: string } | null;
let current: Note = null;
const subs = new Set<() => void>();
let hideTimer: number | undefined;

function announce(text: string, detail?: string) {
  current = { id: Date.now(), text, detail };
  subs.forEach((f) => f());
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    current = null;
    subs.forEach((f) => f());
  }, 2000);
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

/** Mounted once in the root layout. */
export function Toaster() {
  const note = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  const [last, setLast] = useState<Note>(null);
  if (note && note !== last) setLast(note);
  return (
    <div className={`toast ${note ? "show" : ""}`} role="status" aria-live="polite" data-testid="toast">
      <span className="tk">
        <Check size={15} weight="bold" />
      </span>
      <span>
        {last?.text}
        {last?.detail ? (
          <>
            {" "}
            <code>{last.detail}</code>
          </>
        ) : null}
      </span>
    </div>
  );
}

async function writeClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Older browsers and some in-app views refuse the async clipboard.
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
  }
}

export function useCopyCa() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const live = TOKEN.isLive;
  const copy = async () => {
    if (!live) return;
    await writeClipboard(BRAND.ca);
    announce(`${BRAND.symbol} address copied`, shortAddress(BRAND.ca, 6, 4));
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy, live };
}

/** The pill. `size="sm"` for tight rows (footer on phones, spotlight). */
export function CaPill({ size, id = "ca" }: { size?: "sm"; id?: string }) {
  const { copied, copy, live } = useCopyCa();
  return (
    <span className={`capill ${size === "sm" ? "sm" : ""}`} data-testid={`${id}-pill`}>
      <span className="tick">{BRAND.symbol}</span>
      {live ? (
        <>
          <a className="ad" href={explorerToken(BRAND.ca)} target="_blank" rel="noreferrer" data-testid={`${id}-addr`} aria-describedby={`${id}-tip`}>
            {shortAddress(BRAND.ca, 6, 4)}
          </a>
          <span className="tip" id={`${id}-tip`} role="tooltip">
            {BRAND.ca}
          </span>
          <a className="ex" href={explorerToken(BRAND.ca)} target="_blank" rel="noreferrer" aria-label="Open the contract on Blockscout">
            <ArrowUpRight size={14} />
          </a>
        </>
      ) : (
        <>
          <span className="ad wait" data-testid={`${id}-addr`}>
            address at launch
          </span>
          <span className="tip" role="tooltip">
            Published here on launch day. Trust no other address.
          </span>
        </>
      )}
      <button
        type="button"
        className={`cp ${copied ? "ok" : ""}`}
        onClick={copy}
        disabled={!live}
        aria-label={live ? `Copy the ${BRAND.symbol} contract address` : "Contract address not published yet"}
        data-testid={`${id}-copy`}
      >
        {copied ? <Check size={15} weight="bold" /> : <CopySimple size={15} />}
      </button>
    </span>
  );
}

/** Copies any address (a launch's token) with the same toast. */
export function CopyText({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="cp-mini"
      onClick={async () => {
        await writeClipboard(value);
        announce(`${label} copied`, shortAddress(value, 6, 4));
        setDone(true);
        window.setTimeout(() => setDone(false), 2000);
      }}
      aria-label={`Copy ${label}`}
    >
      {done ? <Check size={13} weight="bold" /> : <CopySimple size={13} />}
    </button>
  );
}
