import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthSecret } from "@/lib/auth/secret";
import {
  SESSION_COOKIE,
  fetchLoggedOutAt,
  readSessionClaims,
  sessionActiveAfterLogout,
} from "@/lib/auth/session";

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
 *
 * Auth: REQUIRE_AUTH=1 sends visitors without a session cookie to /connect/.
 * Default is off so Yoni's account keeps working with the APP_USER_ID
 * fallback until OAuth is confirmed. Webhooks, crons, OAuth, and /admin
 * (the only liveness tripwire) stay reachable either way. A missing
 * session must redirect, never 500. A cookie that was valid before the
 * user signed out is treated as logged-out, not as a live session.
 */

export function isPublicPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
  if (path === "/connect") return true;
  if (path === "/join") return true;
  if (path === "/admin") return true;
  if (path.startsWith("/api/auth")) return true;
  if (path.startsWith("/api/webhooks")) return true;
  if (path.startsWith("/api/cron")) return true;
  if (path.startsWith("/api/push")) return true;
  if (path.startsWith("/icons")) return true;
  if (path === "/manifest.webmanifest") return true;
  if (path.startsWith("/sw.js")) return true;
  return false;
}

export type ProxyDeps = {
  loggedOutAt?: (userId: string) => Promise<number | null>;
};

function noStore(res: NextResponse) {
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}

export async function proxy(request: NextRequest, deps: ProxyDeps = {}) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (process.env.REQUIRE_AUTH === "1" && !isPublicPath(pathname)) {
    let userId: string | null = null;
    try {
      const claims = await readSessionClaims(request.cookies.get(SESSION_COOKIE)?.value, getAuthSecret());
      if (claims) {
        const lookup = deps.loggedOutAt ?? fetchLoggedOutAt;
        const loggedOutAt = await lookup(claims.userId);
        if (sessionActiveAfterLogout(claims, loggedOutAt)) userId = claims.userId;
      }
    } catch {
      userId = null;
    }
    if (!userId) {
      const url = request.nextUrl.clone();
      url.pathname = "/connect/";
      url.search = "";
      return noStore(NextResponse.redirect(url));
    }
  }

  if (pathname !== "/" && !pathname.endsWith("/")) {
    const url = request.nextUrl.clone();
    url.pathname = `${pathname}/`;
    return noStore(NextResponse.rewrite(url));
  }

  const next = NextResponse.next();
  if (!isPublicPath(pathname)) return noStore(next);
  return next;
}
