import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/client";
import {
  SESSION_COOKIE,
  expiredSessionCookieOptions,
  readSessionClaims,
  sessionLogoutKey,
} from "@/lib/auth/session";
import { getAuthSecret } from "@/lib/auth/secret";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function clearAndRedirect(req: NextRequest) {
  const secret = getAuthSecret();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = await readSessionClaims(token, secret);
  if (claims) {
    try {
      await getSupabase().from("app_state").upsert({
        key: sessionLogoutKey(claims.userId),
        value: { at: Math.floor(Date.now() / 1000) },
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("mark session logged out failed:", err instanceof Error ? err.message : err);
    }
  }

  const dest = new URL("/connect/", req.nextUrl.origin);
  const res = NextResponse.redirect(dest);
  res.cookies.set(SESSION_COOKIE, "", expiredSessionCookieOptions(req.nextUrl.protocol === "https:"));
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}

export async function GET(req: NextRequest) {
  return clearAndRedirect(req);
}

export async function POST(req: NextRequest) {
  return clearAndRedirect(req);
}
