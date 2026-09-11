import "server-only";
import { cookies } from "next/headers";
import { APP_USER_ID } from "../../../scripts/lib/appUser.mjs";
import { getAuthSecret } from "./secret";
import { getSupabase } from "@/lib/db/client";
import {
  parseLogoutStamp,
  readSessionClaims,
  sessionActiveAfterLogout,
  SESSION_COOKIE,
  sessionLogoutKey,
} from "./session";

async function sessionUserFromCookie(): Promise<string | null> {
  try {
    const jar = await cookies();
    const claims = await readSessionClaims(jar.get(SESSION_COOKIE)?.value, getAuthSecret());
    if (!claims) return null;
    try {
      const { data } = await getSupabase()
        .from("app_state")
        .select("value")
        .eq("key", sessionLogoutKey(claims.userId))
        .maybeSingle();
      if (!sessionActiveAfterLogout(claims, parseLogoutStamp(data?.value))) return null;
    } catch {
      // Stamp lookup failed: HMAC is still valid, same as "never logged out".
    }
    return claims.userId;
  } catch {
    return null;
  }
}

/**
 * The user this request should act as.
 *
 * Prefer the signed session cookie (Onshape OAuth). If there is no session —
 * the live app today, or a visitor before they connect — fall back to Yoni's
 * row so Today/Sessions/Profile keep working. Set REQUIRE_AUTH=1 to send
 * logged-out visitors to /connect instead (see src/proxy.ts).
 */
export async function getCurrentUserId(): Promise<string> {
  return (await sessionUserFromCookie()) ?? APP_USER_ID;
}

export async function getSessionUserId(): Promise<string | null> {
  return sessionUserFromCookie();
}
