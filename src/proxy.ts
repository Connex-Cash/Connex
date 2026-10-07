import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/*
 * Keeps *.vercel.app from competing with the real domain in search results:
 * the production deployment's vercel.app host 308-redirects to connex.cash,
 * and preview deployments are served with X-Robots-Tag: noindex.
 */

const CANONICAL = "https://connex.cash";

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  if (host.endsWith(".vercel.app")) {
    if (process.env.VERCEL_ENV === "production") {
      const target = new URL(request.nextUrl.pathname + request.nextUrl.search, CANONICAL);
      return NextResponse.redirect(target, 308);
    }
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  if (process.env.VERCEL_ENV === "preview") {
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
