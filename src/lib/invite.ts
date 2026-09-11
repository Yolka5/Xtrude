/**
 * Shareable league invite: the join code lives in the query string so a
 * logged-out visitor can be sent through /connect/ and still land in the
 * league afterward.
 */
export const INVITE_COOKIE = "xtrude_invite";
export const INVITE_COOKIE_MAX_AGE_SEC = 60 * 30;

export function parseInviteCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  if (code.length < 4 || code.length > 8) return null;
  if (!/^[A-Z0-9]+$/.test(code)) return null;
  return code;
}

export function invitePath(code: string): string {
  return `/join/?code=${encodeURIComponent(code)}`;
}

export function connectPathWithInvite(code: string): string {
  return `/connect/?next=${encodeURIComponent(invitePath(code))}`;
}

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  if (raw.includes("://")) return null;
  return raw;
}

export function oauthStartPath(next: string | null | undefined): string {
  const safe = safeNextPath(next);
  if (!safe) return "/api/auth/onshape/start";
  return `/api/auth/onshape/start?next=${encodeURIComponent(safe)}`;
}

export function inviteCodeFromNext(next: string | null | undefined): string | null {
  const path = safeNextPath(next);
  if (!path) return null;
  try {
    const url = new URL(path, "http://xtrude.local");
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    if (pathname !== "/join") return null;
    return parseInviteCode(url.searchParams.get("code"));
  } catch {
    return null;
  }
}

export type JoinLanding =
  | { action: "invalid" }
  | { action: "connect"; code: string; next: string }
  | { action: "join"; code: string; userId: string };

export function planJoinLanding(opts: { code: string | null; sessionUserId: string | null }): JoinLanding {
  const code = parseInviteCode(opts.code);
  if (!code) return { action: "invalid" };
  if (!opts.sessionUserId) return { action: "connect", code, next: invitePath(code) };
  return { action: "join", code, userId: opts.sessionUserId };
}

export function inviteCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: INVITE_COOKIE_MAX_AGE_SEC,
  };
}
