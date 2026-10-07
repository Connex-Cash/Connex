"use client";

import { useEffect, useState } from "react";

type Choice = "system" | "light" | "dark";
const KEY = "connex-theme";

/** System / light / dark, remembered in this browser only. */
export function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(KEY);
        if (saved === "light" || saved === "dark") setChoice(saved);
      } catch {
        // Storage blocked: stay on the system setting.
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const pick = (c: Choice) => {
    setChoice(c);
    try {
      if (c === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, c);
    } catch {
      // Not remembered, still applied below.
    }
    const root = document.documentElement;
    if (c === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", c);
  };
  return (
    <div className="seg" role="group" aria-label="Colour theme">
      {(["system", "light", "dark"] as const).map((c) => (
        <button key={c} type="button" className={choice === c ? "on" : ""} aria-pressed={choice === c} onClick={() => pick(c)}>
          {c[0].toUpperCase() + c.slice(1)}
        </button>
      ))}
    </div>
  );
}
