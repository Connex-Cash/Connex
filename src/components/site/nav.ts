/** Header navigation: one plain tab and four menus, in the order they appear. */
export type NavItem = { href: string; label: string; icon?: string; fresh?: boolean };
export type NavGroup = { label: string; items: NavItem[]; glow?: boolean };

export const HOME_TAB: NavItem = { href: "/", label: "Home" };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Launches",
    items: [
      { href: "/round", label: "Current round" },
      { href: "/launches", label: "All launches" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/earnings", label: "Earnings" },
      { href: "/spend", label: "Spend" },
    ],
  },
  {
    label: "About",
    items: [
      { href: "/playbook", label: "Playbook" },
      { href: "/docs", label: "Docs" },
      { href: "/contracts", label: "Contracts" },
      { href: "/terms", label: "Terms" },
    ],
  },
  {
    label: "Lanes",
    glow: true,
    items: [
      { href: "/launches?show=eth", label: "ETH pairs", icon: "◆" },
      { href: "/launches?show=stock", label: "Stock pairs", icon: "▲" },
      { href: "/launches?show=breaking", label: "Breaking", icon: "⚡", fresh: true },
      { href: "/token", label: "$CONNEX token", icon: "●" },
    ],
  },
];
