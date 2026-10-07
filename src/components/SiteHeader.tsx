import Link from "next/link";
import { CopyCaTag } from "@/components/CopyCa";
import { StatusStrip } from "@/components/site/StatusStrip";
import { DesktopNav, MobileNav } from "@/components/site/NavLinks";
import { Wordmark } from "@/components/ui";
import { NavWallet } from "@/components/wallet/WalletButton";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 bg-paper">
      <StatusStrip />
      <div className="relative border-b-2 border-ink">
        <div className="wrap flex h-[60px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/" aria-label="CONNEX home" className="no-underline">
              <Wordmark />
            </Link>
            <DesktopNav />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CopyCaTag />
            <NavWallet />
            <MobileNav />
          </div>
        </div>
      </div>
    </header>
  );
}
