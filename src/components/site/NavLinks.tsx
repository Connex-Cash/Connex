"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { HOME_TAB, NAV_GROUPS, type NavItem } from "./nav";

function useIsActive() {
  const path = usePathname() || "/";
  const params = useSearchParams();
  const show = params?.get("show") ?? "";
  return (item: NavItem) => {
    const [p, q] = item.href.split("?");
    if (p === "/") return path === "/";
    if (q) return path === p && q === `show=${show}`;
    if (p === "/launches") return (path === "/launches" && !show) || path.startsWith("/launches/");
    return path === p;
  };
}

function Tabs() {
  const isActive = useIsActive();
  const path = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setOpen(null), 0);
    return () => window.clearTimeout(t);
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav className="tabs" aria-label="Pages" ref={root}>
      <Link href={HOME_TAB.href} aria-current={isActive(HOME_TAB) ? "page" : undefined}>
        {HOME_TAB.label}
      </Link>
      {NAV_GROUPS.map((g) => {
        const on = g.items.some(isActive);
        const isOpen = open === g.label;
        return (
          <div key={g.label} className={`menu ${g.glow ? "lanes" : ""} ${on ? "on" : ""} ${isOpen ? "open" : ""}`}>
            <button type="button" className={`menu-b ${g.glow ? "glow" : ""}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : g.label)}>
              {g.glow ? <span>{g.label}</span> : g.label}
              <i aria-hidden="true">▾</i>
            </button>
            <div className="menu-m">
              {g.items.map((it) => (
                <Link key={it.href} href={it.href} aria-current={isActive(it) ? "page" : undefined} onClick={() => setOpen(null)}>
                  {it.icon ? <em aria-hidden="true">{it.icon}</em> : null}
                  {it.label}
                  {it.fresh ? <b className="tagnew">new</b> : null}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

/** Desktop: tabs in the bar. Phones: the same tabs fixed to the bottom, menus open upwards. */
export function NavTabs() {
  return (
    <Suspense fallback={<nav className="tabs" aria-label="Pages" />}>
      <Tabs />
    </Suspense>
  );
}
