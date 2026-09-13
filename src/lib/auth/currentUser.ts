import "server-only";
import { cookies } from "next/headers";
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
      const sb = getSupabase();
      const [stamp, user] = await Promise.all([
        sb.from("app_state").select("value").eq("key", sessionLogoutKey(claims.userId)).maybeSingle(),
        sb.from("users").select("id").eq("id", claims.userId).maybeSingle(),
      ]);
      if (!sessionActiveAfterLogout(claims, parseLogoutStamp(stamp.data?.value))) return null;
      // A signed cookie for an account that no longer exists is logged out -
      // never an empty shell that pages would fill with placeholder data.
      if (!user.error && !user.data) return null;
    } catch {
      // Lookup failed: HMAC is still valid, same as "never logged out".
    }
    return claims.userId;
  } catch {
    return null;
  }
}

/**
 * The signed-in user for this request. No fallback account — a missing
 * session is logged out, not someone else's profile.
 */
export async function getCurrentUserId(): Promise<string> {
  const userId = await sessionUserFromCookie();
  if (!userId) throw new Error("unauthenticated");
  return userId;
}

export async function getSessionUserId(): Promise<string | null> {
  return sessionUserFromCookie();
}
