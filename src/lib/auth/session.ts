/**
 * Signed httpOnly session cookie. HMAC-SHA256 over a base64url payload.
 * Uses Web Crypto so the same module runs in Node route handlers and in
 * Next's proxy (Edge). Tokens themselves never go in this cookie — only
 * the Xtrude user id and an expiry.
 */

export const SESSION_COOKIE = "xtrude_session";
export const STATE_COOKIE = "xtrude_oauth_state";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64url(new Uint8Array(sig));
}

export type SessionClaims = {
  userId: string;
  exp: number;
  iat: number;
};

export function sessionLogoutKey(userId: string): string {
  return `session_logout_${userId}`;
}

export function parseLogoutStamp(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const at = (value as { at?: unknown }).at;
  return typeof at === "number" && Number.isFinite(at) ? at : null;
}

/** Issued-at must be strictly after the last logout, or the cookie is dead. */
export function sessionActiveAfterLogout(
  claims: SessionClaims | null,
  loggedOutAtSec: number | null | undefined
): boolean {
  if (!claims) return false;
  if (loggedOutAtSec == null) return true;
  return claims.iat > loggedOutAtSec;
}

export async function createSessionToken(
  userId: string,
  secret: string,
  nowSec: number = Math.floor(Date.now() / 1000)
): Promise<string> {
  const exp = nowSec + SESSION_MAX_AGE_SEC;
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ u: userId, e: exp, i: nowSec })));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function readSessionClaims(
  token: string | undefined,
  secret: string | undefined,
  nowSec: number = Math.floor(Date.now() / 1000)
): Promise<SessionClaims | null> {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(secret, payload);
  if (!timingSafeEqual(expected, sig)) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as {
      u?: string;
      e?: number;
      i?: number;
    };
    if (!json.u || typeof json.e !== "number") return null;
    if (json.e < nowSec) return null;
    return {
      userId: json.u,
      exp: json.e,
      iat: typeof json.i === "number" ? json.i : 0,
    };
  } catch {
    return null;
  }
}

export async function readSessionUserId(
  token: string | undefined,
  secret: string | undefined
): Promise<string | null> {
  const claims = await readSessionClaims(token, secret);
  return claims?.userId ?? null;
}

/**
 * HMAC-valid cookie that was issued before this user's last sign-out is
 * unauthenticated. `loggedOutAtSec` comes from app_state (or a test stub).
 */
export async function authenticatedUserId(
  token: string | undefined,
  secret: string | undefined,
  loggedOutAtSec: number | null | undefined,
  nowSec?: number
): Promise<string | null> {
  const claims = await readSessionClaims(token, secret, nowSec);
  if (!sessionActiveAfterLogout(claims, loggedOutAtSec)) return null;
  return claims.userId;
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  };
}

export function expiredSessionCookieOptions(secure: boolean) {
  return {
    ...sessionCookieOptions(secure),
    maxAge: 0,
  };
}

/**
 * Edge-safe lookup of the per-user logout stamp. Missing env or a failed
 * fetch is treated as "never logged out" so a Supabase blip does not kick
 * every visitor to /connect/. Sign-out still clears the browser cookie.
 */
export async function fetchLoggedOutAt(userId: string): Promise<number | null> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  const url = new URL(`${base.replace(/\/$/, "")}/rest/v1/app_state`);
  url.searchParams.set("key", `eq.${sessionLogoutKey(userId)}`);
  url.searchParams.set("select", "value");
  try {
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ value?: unknown }>;
    return parseLogoutStamp(rows?.[0]?.value);
  } catch {
    return null;
  }
}
