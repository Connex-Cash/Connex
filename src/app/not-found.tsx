import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <main>
      <section className="band first">
        <div className="wrap narrow">
          <div className="band-h">
            <div>
              <div className="kicker">404</div>
              <h1 className="title">This Trend Never Converted</h1>
              <p>Nothing lives at this address. The current round is still running.</p>
            </div>
          </div>
          <div className="ctas">
            <Link href="/round" className="btn go big">
              Current round
            </Link>
            <Link href="/" className="btn big">
              Home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
