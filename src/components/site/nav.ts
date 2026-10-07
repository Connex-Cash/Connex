export const NAV = [
  { href: "/round", label: "Round" },
  { href: "/launches", label: "Launches" },
  { href: "/earnings", label: "Money" },
  { href: "/playbook", label: "Playbook" },
  { href: "/docs", label: "Docs" },
  { href: "/token", label: "Token" },
] as const;

/** Pages that light up a nav item besides its own path. */
export const NAV_ALIASES: Record<string, string> = { "/spend": "/earnings", "/contracts": "/docs" };
