import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <main className="wrap-md py-16">
      <div className="page-h">
        <p className="m-0 font-mono text-[13px] text-ink-4">404</p>
        <h1>This trend never converted</h1>
        <p>Nothing lives at this address. The current round is still running.</p>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/round" className="btn btn-ink">
          Current round
        </Link>
        <Link href="/" className="btn">
          Home
        </Link>
      </div>
    </main>
  );
}
