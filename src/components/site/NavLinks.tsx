"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { NAV, NAV_ALIASES } from "./nav";

function useActive() {
  const path = usePathname() || "/";
  return (href: string) => {
    const base = "/" + (path.split("/")[1] ?? "");
    return base === href || NAV_ALIASES[base] === href;
  };
}

export function DesktopNav() {
  const active = useActive();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          aria-current={active(n.href) ? "page" : undefined}
          className={`rounded-[3px] px-2.5 py-1.5 text-[14px] font-medium no-underline transition-colors ${active(n.href) ? "bg-ink text-inkfg" : "text-ink-2 hover:text-ink"}`}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname() || "/";
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path;
  const setOpen = (fn: (v: boolean) => boolean) => setOpenAt(fn(open) ? path : null);
  const active = useActive();
  return (
    <div className="lg:hidden">
      <button type="button" className="xlink" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
        {open ? <X size={20} /> : <List size={20} />}
      </button>
      {open ? (
        <nav id="mobile-nav" aria-label="Main" className="absolute inset-x-0 top-full z-40 border-b-2 border-ink bg-paper">
          <ul className="wrap !mx-auto !my-0 grid list-none grid-cols-2 gap-x-4 py-3 sm:grid-cols-3">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className={`block border-b border-line py-2.5 font-display text-[18px] font-extrabold no-underline ${active(n.href) ? "text-signal-ink" : ""}`}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
