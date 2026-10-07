import Link from "next/link";

export function MoneyTabs({ on }: { on: "earnings" | "spend" }) {
  return (
    <nav aria-label="Money" className="seg w-fit">
      <Link href="/earnings" className={on === "earnings" ? "on" : ""} aria-current={on === "earnings" ? "page" : undefined}>
        Earnings and treasury
      </Link>
      <Link href="/spend" className={on === "spend" ? "on" : ""} aria-current={on === "spend" ? "page" : undefined}>
        Spend
      </Link>
    </nav>
  );
}
