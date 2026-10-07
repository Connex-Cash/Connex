"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowsDownUp, GearSix } from "@phosphor-icons/react";
import { EthGlyph } from "@/components/ui";
import { CHAIN, PONS } from "@/config/brand";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { rpc } from "@/lib/rpc";
import { formatUnits, loadMarket, parseUnits, plan, quote, tokenBalance, waitForReceipt, withSlippage, type Market } from "@/lib/pons";

/*
 * A real swap card for any Pons V2 launch priced in ETH: quotes are read from
 * the chain and the trade is sent by the visitor's own wallet (curve before
 * graduation, Uniswap v4 pool after). `token` null means "not launched yet".
 */

const SLIPPAGES = [50, 100, 300];
/** Left in the wallet on a max buy so the swap itself can pay for gas. */
const GAS_RESERVE = 20_000_000_000_000n; // 0.00002 ETH

function useBalances(token: string | null, address: string | null, tick: number) {
  const [value, setValue] = useState<{ eth: bigint | null; token: bigint | null }>({ eth: null, token: null });
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const load = () => {
      rpc<string>("eth_getBalance", [address, "latest"])
        .then((hex) => !cancelled && setValue((v) => ({ ...v, eth: BigInt(hex) })))
        .catch(() => {});
      if (token) {
        tokenBalance(token, address)
          .then((raw) => !cancelled && setValue((v) => ({ ...v, token: raw })))
          .catch(() => {});
      }
    };
    load();
    const timer = window.setInterval(load, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, address, tick]);
  return address ? value : { eth: null, token: null };
}

function useMarket(token: string | null, tick: number) {
  const [market, setMarket] = useState<Market | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const load = () =>
      loadMarket(token)
        .then((m) => {
          if (cancelled) return;
          setMarket(m);
          setFailed(false);
        })
        .catch(() => !cancelled && setFailed(true));
    load();
    const timer = window.setInterval(load, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [token, tick]);
  return { market, failed };
}

export function venueLabel(token: string | null, market: Market | null, failed: boolean) {
  if (!token) return "Opens at launch";
  if (failed && !market) return "Could not read the market";
  if (!market) return "Reading the market…";
  if (market.venue === "curve") return "Pons bonding curve";
  if (market.venue === "pool") return "Uniswap v4 pool";
  if (market.venue === "graduating") return "Graduating";
  return market.reason ?? "Unavailable";
}

export function ChainTrade({
  token,
  symbol,
  title = "Trade on chain",
  note,
}: {
  token: string | null;
  symbol: string;
  title?: string;
  note?: string;
}) {
  const [reverse, setReverse] = useState(false);
  const [showSlippage, setShowSlippage] = useState(false);
  const [amount, setAmount] = useState("");
  const { address, chainId, onRobinhoodChain, switchNetwork, switching, sendTransaction, refreshBalance } = useWallet();
  const { open } = useWalletModal();
  const [tick, setTick] = useState(0);
  const balances = useBalances(token, address, tick);
  const { market, failed } = useMarket(token, tick);
  const [slippage, setSlippage] = useState(100);
  const [quoted, setQuoted] = useState<{ key: string; out: bigint } | null>(null);
  const [quoteFailedKey, setQuoteFailedKey] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const buying = !reverse;
  const amountIn = parseUnits(amount);
  const tradable = market?.venue === "curve" || market?.venue === "pool";
  const quoteKey = `${buying}:${amountIn}:${market?.venue}`;

  useEffect(() => {
    if (!market || !tradable || !amountIn) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      quote(market, buying, amountIn, address ?? "0x000000000000000000000000000000000000dEaD")
        .then((out) => !cancelled && setQuoted({ key: quoteKey, out }))
        .catch(() => !cancelled && setQuoteFailedKey(quoteKey));
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [market, tradable, amountIn, buying, address, quoteKey]);

  const out = amountIn && quoted?.key === quoteKey ? quoted.out : null;
  const quoteError = amountIn && out === null && quoteFailedKey === quoteKey ? "No quote for this amount right now." : null;
  const sendBalanceRaw = buying ? balances.eth : balances.token;
  const short = amountIn !== null && sendBalanceRaw !== null && amountIn + (buying ? GAS_RESERVE : 0n) > sendBalanceRaw;

  const fillMax = () => {
    if (sendBalanceRaw === null) return;
    const max = buying ? (sendBalanceRaw > GAS_RESERVE ? sendBalanceRaw - GAS_RESERVE : 0n) : sendBalanceRaw;
    setAmount(formatUnits(max, 18, 18).replace(/,/g, ""));
  };

  const trade = async () => {
    if (!market || !address || !amountIn) return;
    setTradeError(null);
    setLastTx(null);
    try {
      setStage("Quoting…");
      // Re-quote right before signing: curve prices move with every buy.
      const fresh = await quote(market, buying, amountIn, address);
      // Never trade without a floor: a zero minimum can be sandwiched for nearly the whole amount.
      const minOut = withSlippage(fresh, slippage);
      if (fresh <= 0n || minOut <= 0n) throw new Error("No price quote for this amount yet. Try a larger amount or again in a moment.");
      const txs = await plan(market, buying, amountIn, minOut, address);
      for (const [i, tx] of txs.entries()) {
        const step = txs.length > 1 ? ` (${i + 1}/${txs.length})` : "";
        setStage(`${tx.label}${step}: confirm in wallet…`);
        const hash = await sendTransaction(tx);
        setStage(`${tx.label}${step}: waiting for block…`);
        await waitForReceipt(hash);
        if (i === txs.length - 1) setLastTx(hash);
      }
      setAmount("");
    } catch (cause) {
      setTradeError(cause instanceof Error ? cause.message : "The swap did not go through.");
    } finally {
      setStage(null);
      setTick((n) => n + 1);
      refreshBalance();
    }
  };

  const wrong = address !== null && chainId !== null && !onRobinhoodChain;
  const sendToken = reverse ? symbol : "ETH";
  const receiveToken = reverse ? "ETH" : symbol;
  const show = (v: bigint | null) => (v === null ? null : formatUnits(v, 18, 4));

  return (
    <section className="panel p-4" data-testid="chain-trade" aria-label={title}>
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <span className="text-[12px] text-ink-3">
          Venue:{" "}
          <span className="text-ink-2" data-testid="swap-venue">
            {venueLabel(token, market, failed)}
          </span>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <div className="seg flex-1" role="tablist" aria-label="Trade side">
          {([false, true] as const).map((rev) => (
            <button
              key={String(rev)}
              type="button"
              role="tab"
              aria-selected={reverse === rev}
              onClick={() => setReverse(rev)}
              className={rev ? "sell" : "buy"}
            >
              {rev ? "Sell" : "Buy"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowSlippage((v) => !v)}
          aria-expanded={showSlippage}
          aria-label="Slippage settings"
          className="btn grid size-[38px] shrink-0 place-items-center !p-0"
        >
          <GearSix size={16} />
        </button>
      </div>
      {showSlippage ? (
        <div className="mt-2 flex rounded-[6px] border border-line bg-paper items-center justify-between gap-2 px-3 py-2 text-[12px] text-ink-3">
          <span>Max slippage</span>
          <span className="flex gap-3">
            {SLIPPAGES.map((bps) => (
              <button
                key={bps}
                type="button"
                onClick={() => setSlippage(bps)}
                className={`tab num !text-[12px] ${slippage === bps ? "on" : ""}`}
              >
                {bps / 100}%
              </button>
            ))}
          </span>
        </div>
      ) : null}

      <div className="mt-3 rounded-[6px] border border-line-2 bg-card px-3 pt-2.5 pb-2.5">
        <div className="flex items-center justify-between gap-2 text-[12px] text-ink-3">
          <label htmlFor={`pay-${title}`}>You pay</label>
          <span className="flex min-w-0 gap-2">
            <span className="num truncate">Balance {show(sendBalanceRaw) ?? "–"}</span>
            {token && sendBalanceRaw !== null ? (
              <button type="button" onClick={fillMax} className="font-medium text-ink underline underline-offset-2">
                Max
              </button>
            ) : null}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <input
            id={`pay-${title}`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, "");
              const dot = v.indexOf(".");
              setAmount(dot < 0 ? v : v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, ""));
            }}
            className="num min-w-0 flex-1 bg-transparent text-[24px] leading-tight font-medium text-ink outline-none placeholder:text-ink-4"
            aria-label={`Amount of ${sendToken} to send`}
          />
          <span className="inline-flex max-w-[45%] shrink-0 items-center gap-1.5 truncate rounded-[6px] bg-paper-2 py-1 pr-2.5 pl-1.5 font-mono text-[13px]">
            {sendToken === "ETH" ? <EthGlyph size={20} /> : null}
            {sendToken}
          </span>
        </div>
      </div>

      <div className="relative z-10 -my-2 flex justify-center">
        <button
          type="button"
          onClick={() => setReverse((v) => !v)}
          aria-label="Flip direction"
          className="btn grid size-8 place-items-center !p-0"
        >
          <ArrowsDownUp size={14} />
        </button>
      </div>

      <div className="rounded-[6px] border border-line-2 bg-card px-3 pt-2.5 pb-2.5">
        <div className="flex justify-between gap-2 text-[12px] text-ink-3">
          <span>You receive</span>
          <span className="num truncate">Balance {show(buying ? balances.token : balances.eth) ?? "–"}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span
            className={`num min-w-0 flex-1 truncate text-[22px] leading-tight font-medium ${out ? "text-ink" : "text-ink-4"}`}
            data-testid="swap-out"
          >
            {out !== null ? formatUnits(out, 18, buying ? 2 : 6) : "0"}
          </span>
          <span className="inline-flex max-w-[45%] shrink-0 items-center gap-1.5 truncate rounded-[6px] bg-paper-2 py-1 pr-2.5 pl-1.5 font-mono text-[13px]">
            {receiveToken === "ETH" ? <EthGlyph size={20} /> : null}
            {receiveToken}
          </span>
        </div>
      </div>
      <p className="num mt-1.5 min-h-4 px-1 text-[12px] text-ink-3">
        {!token
          ? "Quotes open at launch"
          : quoteError
            ? quoteError
            : out !== null
              ? `At least ${formatUnits(withSlippage(out, slippage), 18, buying ? 2 : 6)} after ${slippage / 100}% slippage`
              : "Fees are included in the quote"}
      </p>

      <div className="mt-3">
        {!address ? (
          <button
            type="button"
            onClick={open}
            className="btn btn-ink btn-block"
            data-testid="swap-connect"
          >
            Connect wallet
          </button>
        ) : wrong ? (
          <button
            type="button"
            onClick={switchNetwork}
            disabled={switching}
            className="btn btn-ink btn-block"
          >
            {switching ? "Confirm in wallet…" : `Switch to ${CHAIN.name}`}
          </button>
        ) : !token ? (
          <button type="button" disabled className="btn btn-block">
            Swaps open at launch
          </button>
        ) : market && market.venue === "unavailable" ? (
          <a
            href={PONS.page(token)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ink btn-block"
          >
            Trade it on Pons <ArrowUpRight size={14} weight="bold" />
          </a>
        ) : (
          <button
            type="button"
            onClick={trade}
            disabled={!tradable || !amountIn || short || out === null || out === 0n || stage !== null}
            className="btn btn-ink btn-block"
            data-testid="swap-submit"
          >
            {stage ??
              (!tradable
                ? "Trading paused"
                : !amountIn
                  ? "Enter an amount"
                  : short
                    ? `Not enough ${buying ? "ETH" : symbol}`
                    : out === null
                      ? "Getting a quote…"
                      : buying
                        ? `Buy ${symbol}`
                        : `Sell ${symbol}`)}
          </button>
        )}
      </div>
      {tradeError ? (
        <p role="alert" className="mt-3 rounded-md bg-down-soft px-3 py-2 text-[12.5px] leading-relaxed break-words text-down">
          {tradeError}
        </p>
      ) : null}
      {lastTx ? (
        <a
          href={`${CHAIN.explorer}/tx/${lastTx}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-center justify-center gap-1 text-[12.5px] text-awake hover:underline"
          data-testid="swap-done"
        >
          Swap confirmed, view the transaction <ArrowUpRight size={12} />
        </a>
      ) : null}
      {note ? <p className="mt-3 text-center text-[11.5px] leading-relaxed text-ink-3">{note}</p> : null}
    </section>
  );
}
