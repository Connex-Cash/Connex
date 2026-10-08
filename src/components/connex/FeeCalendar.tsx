"use client";

import { useMemo, useState } from "react";
import { CHAIN } from "@/config/brand";
import type { Claim } from "@/lib/agent/types";
import { eth, hhmm } from "@/lib/format";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Month grid of fee claims; months with claims can be paged, a day with claims opens its list below. */
export function FeeCalendar({ claims, now, sample }: { claims: Claim[]; now: number; sample: boolean }) {
  const today = new Date(now);
  const first = claims.length ? new Date(Math.min(...claims.map((c) => c.at))) : today;
  const minMonth = first.getUTCFullYear() * 12 + first.getUTCMonth();
  const maxMonth = today.getUTCFullYear() * 12 + today.getUTCMonth();
  const [month, setMonth] = useState(maxMonth);
  const [picked, setPicked] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, { wei: bigint; list: Claim[] }>();
    for (const c of claims) {
      const k = dayKey(c.at);
      const cur = m.get(k) ?? { wei: 0n, list: [] };
      cur.wei += BigInt(c.ethWei);
      cur.list.push(c);
      m.set(k, cur);
    }
    return m;
  }, [claims]);

  const y = Math.floor(month / 12);
  const mo = month % 12;
  const days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(y, mo, 1)).getUTCDay() + 6) % 7;
  const inMonth = [...byDay.entries()].filter(([k]) => k.startsWith(`${y}-${String(mo + 1).padStart(2, "0")}`));
  const max = inMonth.reduce((a, [, v]) => (v.wei > a ? v.wei : a), 1n);
  const total = inMonth.reduce((a, [, v]) => a + v.wei, 0n);
  const name = new Date(Date.UTC(y, mo, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const sel = picked ? byDay.get(picked) : null;

  return (
    <>
      <div className="panel pad" style={{ marginTop: 20 }}>
        <div className="cal-h">
          <button type="button" aria-label="Previous month" disabled={month <= minMonth} onClick={() => setMonth(month - 1)}>
            ‹
          </button>
          <h3>{name}</h3>
          <button type="button" aria-label="Next month" disabled={month >= maxMonth} onClick={() => setMonth(month + 1)}>
            ›
          </button>
          <span className="tot">{eth(total)} ETH this month</span>
        </div>
        <div className="cal" role="grid" aria-label={`Fees per day, ${name}`}>
          {WEEK.map((w) => (
            <div key={w} className="dow" role="columnheader">
              {w}
            </div>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <div key={`l${i}`} className="day out" />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const d = i + 1;
            const k = `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const v = byDay.get(k);
            const future = Date.UTC(y, mo, d) > now;
            const isToday = k === dayKey(now);
            if (v) {
              const ratio = Number((v.wei * 1000n) / max) / 1000;
              return (
                <button
                  key={k}
                  type="button"
                  className={`day has ${isToday ? "today" : ""} ${picked === k ? "sel" : ""}`}
                  style={{ ["--k" as string]: ratio.toFixed(2) }}
                  onClick={() => setPicked(picked === k ? null : k)}
                  aria-pressed={picked === k}
                >
                  <span className="dn">{d}</span>
                  <span>
                    <span className="amt block">{eth(v.wei, 3)}</span>
                    <span className="cnt block">
                      {v.list.length} claim{v.list.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </button>
              );
            }
            return (
              <div key={k} className={`day ${future ? "out" : ""} ${isToday ? "today" : ""}`}>
                <span className="dn">{d}</span>
                {future ? null : <span className="zero">0</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel pad" style={{ marginTop: 20 }} data-testid="day-claims">
        {sel && picked ? (
          <>
            <div className="band-h" style={{ marginBottom: 6 }}>
              <h3>{new Date(`${picked}T00:00:00Z`).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}</h3>
              <span className="faint mono" style={{ fontSize: 12 }}>
                {eth(sel.wei)} ETH{sample ? " · sample" : ""}
              </span>
            </div>
            <ul className="bb">
              {sel.list.map((c) => (
                <li key={c.at}>
                  <span>
                    <span className="amt">{eth(c.ethWei)} ETH</span> <span className="faint">at {hhmm(c.at)} UTC</span>
                  </span>
                  <span className="meta">
                    {eth(c.toBuybackWei)} to buyback · {eth(c.toBudgetWei)} to launches
                    {c.tx ? (
                      <>
                        {" · "}
                        <a href={`${CHAIN.explorer}/tx/${c.tx}`} target="_blank" rel="noreferrer">
                          tx
                        </a>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="empty">Choose a day that has fees to see each claim and how it was split.</div>
        )}
      </div>
    </>
  );
}
