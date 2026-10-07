"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ArrowSquareOut, ArrowsLeftRight, CaretDown, Check, Copy, SignOut, SquaresFour, Wallet, Warning, X } from "@phosphor-icons/react";
import { Mark } from "@/components/Mark";
import { BRAND, CHAIN as chain, explorerAddress, shortAddress } from "@/config/brand";
import { WALLETCONNECT_RDNS, useWallet, type DiscoveredWallet } from "@/components/wallet/WalletProvider";
import { WALLET_CATALOG, catalogIcon } from "@/config/wallets";

/* ------------------------------------------------------------------ */
/* One dialog for the whole site. Every "connect" / "get access" button */
/* opens it through this context instead of owning a copy of it.        */
/* ------------------------------------------------------------------ */

const ModalContext = createContext<{ open: () => void } | null>(null);

export function WalletModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useCallback(() => setOpen(true), []);
  return (
    <ModalContext.Provider value={{ open: value }}>
      {children}
      {open ? <WalletDialog onClose={() => setOpen(false)} /> : null}
    </ModalContext.Provider>
  );
}

export function useWalletModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error("useWalletModal must be used inside WalletModalProvider");
  return context;
}

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function WalletIcon({ src }: { src: string | null }) {
  return src ? (
    <img src={src} alt="" width={28} height={28} className="size-7 shrink-0 rounded-[6px]" />
  ) : (
    <span className="grid size-7 shrink-0 place-items-center rounded-[6px] bg-paper-2 text-ink">
      <Wallet size={16} />
    </span>
  );
}

function WalletDialog({ onClose }: { onClose: () => void }) {
  const { wallets, connect, connecting, error, clearError } = useWallet();
  const [pending, setPending] = useState<string | null>(null);

  const close = useCallback(() => {
    onClose();
    clearError();
  }, [onClose, clearError]);

  useEffect(() => {
    // Late-loading extensions announce on request, so ask again on open.
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [close]);

  const installed = wallets
    .filter((w) => w.rdns !== WALLETCONNECT_RDNS)
    .sort((a, b) => Number(Boolean(a.unsupported)) - Number(Boolean(b.unsupported)));
  const walletConnect = wallets.find((w) => w.rdns === WALLETCONNECT_RDNS) ?? null;
  const detected = new Set(wallets.map((w) => w.rdns));
  const more = WALLET_CATALOG.filter((c) => !c.rdns.some((r) => detected.has(r)));
  const mobile = isMobile();
  const here = window.location.href;

  async function pick(wallet: DiscoveredWallet) {
    setPending(wallet.rdns);
    const ok = await connect(wallet);
    setPending(null);
    if (ok) onClose();
  }

  const row = "rounded-[6px] border border-line bg-card flex w-full items-center gap-3 px-3 py-2.5 text-left text-[14px] font-medium";
  const heading = "px-1 pb-2 font-mono text-[12px] text-ink-3";

  // The header blurs what is behind it, and a backdrop filter turns it into
  // the containing block for fixed children. Rendered in place, the dialog
  // would be clipped to the header, so it always goes to <body>.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-dialog-title"
      className="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:p-4"
    >
      <div className="absolute inset-0 bg-ink/55" onClick={close} />
      <div className="panel relative flex max-h-[92dvh] w-full max-w-[420px] flex-col overflow-hidden shadow-[0_8px_24px_#0000002e] max-md:rounded-b-none">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <Mark size={28} />
            <h2 id="wallet-dialog-title" className="text-[17px] font-semibold">
              Connect a wallet
            </h2>
          </div>
          <button type="button" aria-label="Close" onClick={close} className="xlink">
            <X size={14} />
          </button>
        </div>

        <p className="px-5 text-[13px] leading-relaxed text-ink-2">
          Any EVM wallet that can add a custom network works on {chain.name}. Connecting only shares your address; signatures and swaps are
          asked for separately.
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-2">
          {installed.length ? (
            <>
              <p className={heading}>Detected in this browser</p>
              <ul className="flex flex-col gap-2">
                {installed.map((wallet) => (
                  <li key={wallet.rdns}>
                    <button
                      type="button"
                      disabled={connecting || Boolean(wallet.unsupported)}
                      onClick={() => pick(wallet)}
                      className={`${row} cursor-pointer transition-colors enabled:hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <WalletIcon src={wallet.icon || catalogIcon(wallet.rdns)} />
                      <span className="min-w-0 flex-1">
                        <span className="block">{wallet.name}</span>
                        <span className="block text-[12px] font-normal text-ink-3">
                          {wallet.unsupported ? `Not supported · ${wallet.unsupported}` : "Installed"}
                        </span>
                      </span>
                      {pending === wallet.rdns ? <span className="text-[12px] text-ink-3">Check wallet</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className={`${heading} pt-4`}>Mobile and other wallets</p>
          {walletConnect ? (
            <button
              type="button"
              disabled={connecting}
              onClick={() => pick(walletConnect)}
              className={`${row} cursor-pointer transition-colors enabled:hover:bg-paper-2 disabled:opacity-50`}
              data-testid="wallet-walletconnect"
            >
              <WalletIcon src="/wallets/walletconnect.webp" />
              <span className="min-w-0 flex-1">
                <span className="block">WalletConnect</span>
                <span className="block text-[12px] font-normal text-ink-3">Scan a QR code with a mobile wallet</span>
              </span>
              {pending === WALLETCONNECT_RDNS ? <span className="text-[12px] text-ink-3">Opening</span> : null}
            </button>
          ) : (
            <div className={`${row} opacity-50`} data-testid="wallet-walletconnect">
              <WalletIcon src="/wallets/walletconnect.webp" />
              <span className="min-w-0 flex-1">
                <span className="block">WalletConnect</span>
                <span className="block text-[12px] font-normal text-ink-3">Not configured on this site yet</span>
              </span>
            </div>
          )}

          {more.length ? (
            <>
              <p className={`${heading} pt-4`}>{mobile ? "Open this site in a wallet app" : `Not installed · supports ${chain.name}`}</p>
              <ul className="flex flex-col gap-2">
                {more.map((w) => {
                  const href = mobile && w.deepLink ? w.deepLink(here) : w.install;
                  const label = mobile && w.deepLink ? "Open" : "Install";
                  return (
                    <li key={w.id}>
                      <a href={href} target="_blank" rel="noreferrer" className={`${row} transition-colors hover:bg-paper-2`}>
                        <WalletIcon src={`/wallets/${w.id}.webp`} />
                        <span className="min-w-0 flex-1">{w.name}</span>
                        <span className="inline-flex items-center gap-1 text-[12px] text-nova">
                          {label} <ArrowSquareOut size={14} />
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>

        {error ? (
          <p className="mx-5 mb-1 flex items-start gap-2 rounded-md bg-down-soft px-3 py-2 text-[12.5px] leading-relaxed text-down">
            <Warning size={14} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}

        <p className="px-5 pt-2 pb-5 text-[12px] leading-relaxed text-ink-3">
          {chain.name} · chain id {chain.id} · added to your wallet on connect
        </p>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* Navbar control                                                      */
/* ------------------------------------------------------------------ */

export function NavWallet({ compact = false }: { compact?: boolean }) {
  const { address } = useWallet();
  const { open } = useWalletModal();
  if (address) return <AccountMenu compact={compact} />;
  return (
    <button type="button" onClick={open} className="btn btn-sm shrink-0">
      Connect
    </button>
  );
}

function AccountMenu({ compact }: { compact: boolean }) {
  const { address, walletName, chainId, balance, onRobinhoodChain, switchNetwork, switching, disconnect, error } = useWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const WIDTH = 272;
    const position = () => {
      const rect = root.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, Math.min(rect.right - WIDTH, window.innerWidth - WIDTH - 8));
      setPlace({ top: rect.bottom + 8, left });
    };
    position();
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open]);

  if (!address) return null;
  const wrongNetwork = chainId !== null && !onRobinhoodChain;

  return (
    <div ref={root} className="flex items-center gap-2">
      {wrongNetwork ? (
        <button
          type="button"
          onClick={switchNetwork}
          disabled={switching}
          title={`Wallet is on chain ${chainId}. Switch to ${chain.name}.`}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] bg-down-soft px-2.5 text-[12px] font-semibold text-down transition-colors hover:bg-down-soft disabled:opacity-60"
        >
          <Warning size={14} />
          <span className="hidden sm:inline">{switching ? "Confirm…" : compact ? `Chain ${chainId}` : `Wrong network · ${chainId}`}</span>
        </button>
      ) : null}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="btn btn-sm num shrink-0 font-normal"
      >
        <span className={`size-1.5 rounded-full ${onRobinhoodChain ? "bg-awake" : "bg-down"}`} />
        <span className="sm:hidden">{shortAddress(address, 4, 3)}</span>
        <span className="hidden sm:inline">{shortAddress(address, compact ? 4 : 6, 4)}</span>
        {!compact && balance !== null ? <span className="hidden text-ink-2 lg:inline">{balance} ETH</span> : null}
        <CaretDown size={12} className="text-ink-3" />
      </button>

      {open && place
        ? createPortal(
            <div
              ref={menu}
              role="menu"
              style={{ position: "fixed", top: place.top, left: place.left }}
              className="panel z-[80] w-[272px] overflow-hidden p-1.5 shadow-[0_8px_24px_#0000002e]"
            >
              <div className="rounded-[6px] border border-line bg-paper px-3.5 py-3">
                <p className="text-[12px] text-ink-3">{walletName ?? "Wallet"}</p>
                <p className="num mt-1 text-[13px] text-ink">{shortAddress(address, 10, 8)}</p>
                <p className="num mt-2 text-[15px] text-ink">{balance === null ? "…" : `${balance} ${chain.nativeSymbol}`}</p>
                <p className={`mt-1 flex items-center gap-1.5 text-[12px] ${wrongNetwork ? "text-down" : "text-ink-3"}`}>
                  <span className={`size-1.5 rounded-full ${wrongNetwork ? "bg-down" : "bg-awake"}`} />
                  {chainId === null ? "Reading network…" : onRobinhoodChain ? `On ${chain.name}` : `On chain ${chainId}, not ${chain.name}`}
                </p>
              </div>

              {wrongNetwork ? (
                <div className="px-1 pt-2">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={switching}
                    onClick={switchNetwork}
                    className="btn btn-ink btn-sm w-full"
                  >
                    {switching ? "Confirm in wallet…" : `Switch to ${chain.name}`}
                  </button>
                  {error ? <p className="mt-2 px-1 text-[12px] leading-relaxed text-down">{error}</p> : null}
                </div>
              ) : null}

              <div className="flex flex-col pt-1.5 text-[13px]">
                <button
                  type="button"
                  role="menuitem"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(address);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1400);
                    } catch {
                      // Clipboard refused; the address above stays readable.
                    }
                  }}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                >
                  {copied ? <Check size={15} className="text-awake" /> : <Copy size={15} />}
                  {copied ? "Copied" : "Copy address"}
                </button>
                <Link
                  role="menuitem"
                  href="/round"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                >
                  <SquaresFour size={15} />
                  Open app: current round
                </Link>
                <Link
                  role="menuitem"
                  href="/token"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                >
                  <ArrowsLeftRight size={15} />
                  {BRAND.symbol} token
                </Link>
                <a
                  role="menuitem"
                  href={explorerAddress(address)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                >
                  <ArrowSquareOut size={15} />
                  View on explorer
                </a>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    disconnect();
                  }}
                  className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-down transition-colors hover:bg-down-soft"
                >
                  <SignOut size={15} />
                  Disconnect
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Large call-to-action ("Connect wallet")                          */
/* ------------------------------------------------------------------ */

export function AccessButton({ className = "" }: { className?: string }) {
  const { address, onRobinhoodChain, chainId, switchNetwork, switching } = useWallet();
  const { open } = useWalletModal();

  if (address && chainId !== null && !onRobinhoodChain) {
    return (
      <button
        type="button"
        onClick={switchNetwork}
        disabled={switching}
        className={`btn btn-ink ${className}`}
      >
        {switching ? "Confirm in wallet…" : `Switch to ${chain.name}`}
        <span aria-hidden="true">→</span>
      </button>
    );
  }
  if (address) {
    return (
      <Link href="/round" className={`btn btn-ink ${className}`}>
        <span>
          Wallet linked · <span className="normal-case">{shortAddress(address, 4, 4)}</span>
        </span>
        <span aria-hidden="true">→</span>
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      className={`btn btn-ink ${className}`}
    >
      Connect wallet
      <span aria-hidden="true">→</span>
    </button>
  );
}
