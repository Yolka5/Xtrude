import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * next.config trailingSlash: true would 308 POST /api/webhooks/onshape to
 * the slashed URL. Onshape registered the unsashed URL and does not replay
 * the POST body after a 308, so deliveries never reached the handler.
 * skipTrailingSlashRedirect turns that off; this proxy keeps page URLs
 * slashed (GET redirect) and internally rewrites /api/* so POST bodies
 * survive. Existing Onshape registrations stay valid — no re-register.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && !pathname.endsWith("/")) {
    const url = request.nextUrl.clone();
    url.pathname = `${pathname}/`;
    return NextResponse.rewrite(url);
  }

  if (!pathname.startsWith("/api/") && pathname !== "/" && !pathname.endsWith("/")) {
    const url = request.nextUrl.clone();
    url.pathname = `${pathname}/`;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}
