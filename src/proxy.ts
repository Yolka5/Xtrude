import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * next.config trailingSlash: true would 308 POST /api/webhooks/onshape to
 * the slashed URL. Onshape registered the unsashed URL and does not replay
 * the POST body after a 308, so deliveries never reached the handler.
 * skipTrailingSlashRedirect turns that off; this proxy internally rewrites
 * unsashed paths to their slashed counterparts so POST bodies survive and
 * page navigations do not bounce. A 308 here is unsafe: Next/Vercel strip
 * the trailing slash from the Location header, which turned /sessions into
 * a self-redirect loop ("too many redirects"). Existing Onshape
 * registrations stay valid — no re-register.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (pathname !== "/" && !pathname.endsWith("/")) {
    const url = request.nextUrl.clone();
    url.pathname = `${pathname}/`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}
