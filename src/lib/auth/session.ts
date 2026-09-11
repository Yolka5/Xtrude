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

export async function createSessionToken(userId: string, secret: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ u: userId, e: exp })));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function readSessionUserId(
  token: string | undefined,
  secret: string | undefined
): Promise<string | null> {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(secret, payload);
  if (!timingSafeEqual(expected, sig)) return null;
  try {
    const json = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { u?: string; e?: number };
    if (!json.u || typeof json.e !== "number") return null;
    if (json.e < Date.now() / 1000) return null;
    return json.u;
  } catch {
    return null;
  }
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
