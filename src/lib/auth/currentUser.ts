import "server-only";
import { cookies } from "next/headers";
import { APP_USER_ID } from "../../../scripts/lib/appUser.mjs";
import { getAuthSecret } from "./secret";
import { readSessionUserId, SESSION_COOKIE } from "./session";

/**
 * The user this request should act as.
 *
 * Prefer the signed session cookie (Onshape OAuth). If there is no session —
 * the live app today, or a visitor before they connect — fall back to Yoni's
 * row so Today/Sessions/Profile keep working. Set REQUIRE_AUTH=1 to send
 * logged-out visitors to /connect instead (see src/proxy.ts).
 */
export async function getCurrentUserId(): Promise<string> {
  try {
    const jar = await cookies();
    const userId = await readSessionUserId(jar.get(SESSION_COOKIE)?.value, getAuthSecret());
    if (userId) return userId;
  } catch {
    // cookies() is unavailable in some script/build contexts
  }
  return APP_USER_ID;
}

export async function getSessionUserId(): Promise<string | null> {
  try {
    const jar = await cookies();
    return await readSessionUserId(jar.get(SESSION_COOKIE)?.value, getAuthSecret());
  } catch {
    return null;
  }
}
