/**
 * Pure OAuth access-token decisions. Importable from scripts/verify-derive.ts.
 * I/O (decrypt, store, app_state) lives in tokens.ts.
 */
export const REFRESH_SKEW_MS = 5 * 60 * 1000;

export function oauthReauthKey(userId: string): string {
  return `oauth_reauth_${userId}`;
}

export function onshapeImageKey(userId: string): string {
  return `onshape_image_${userId}`;
}

export function accessTokenIsFresh(
  expiresAtMs: number,
  nowMs: number,
  skewMs: number = REFRESH_SKEW_MS
): boolean {
  return Number.isFinite(expiresAtMs) && expiresAtMs - nowMs > skewMs;
}

export function isUnauthorizedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\bHTTP 401\b|\bHTTP 403\b|unauthoriz/i.test(msg);
}

export type OAuthCallOk<T> = {
  status: "ok";
  value: T;
  refreshCalls: number;
  requestCalls: number;
};

export type OAuthCallFail = {
  status: "needs_reauth" | "blocked";
  refreshCalls: number;
  requestCalls: number;
  reason: string;
};

/**
 * One refresh max. If the stored access token is expired (or within skew),
 * refresh first, then run the original request. If the request comes back
 * 401/403 and we have not refreshed yet, refresh once and retry it.
 * A failed refresh (or a 401 after that single refresh) flips needs-reauth
 * and does not try Onshape again.
 */
export async function withOAuthAccess<T>(opts: {
  needsReauth: boolean;
  expiresAtMs: number;
  nowMs?: number;
  getAccessToken: () => string;
  refresh: () => Promise<{ accessToken: string }>;
  request: (accessToken: string) => Promise<T>;
  isUnauthorized?: (err: unknown) => boolean;
}): Promise<OAuthCallOk<T> | OAuthCallFail> {
  const unauthorized = opts.isUnauthorized ?? isUnauthorizedError;
  if (opts.needsReauth) {
    return { status: "blocked", refreshCalls: 0, requestCalls: 0, reason: "needs_reauth" };
  }

  const nowMs = opts.nowMs ?? Date.now();
  let access = opts.getAccessToken();
  let refreshCalls = 0;
  let requestCalls = 0;
  let refreshed = false;

  async function doRefresh(): Promise<boolean> {
    if (refreshed) return false;
    refreshCalls += 1;
    refreshed = true;
    try {
      const fresh = await opts.refresh();
      access = fresh.accessToken;
      return true;
    } catch (err) {
      return false;
    }
  }

  if (!accessTokenIsFresh(opts.expiresAtMs, nowMs)) {
    const ok = await doRefresh();
    if (!ok) {
      return {
        status: "needs_reauth",
        refreshCalls,
        requestCalls,
        reason: "refresh_failed",
      };
    }
  }

  try {
    requestCalls += 1;
    const value = await opts.request(access);
    return { status: "ok", value, refreshCalls, requestCalls };
  } catch (err) {
    if (!unauthorized(err)) throw err;
    if (refreshed) {
      return {
        status: "needs_reauth",
        refreshCalls,
        requestCalls,
        reason: "unauthorized_after_refresh",
      };
    }
    const ok = await doRefresh();
    if (!ok) {
      return { status: "needs_reauth", refreshCalls, requestCalls, reason: "refresh_failed" };
    }
    try {
      requestCalls += 1;
      const value = await opts.request(access);
      return { status: "ok", value, refreshCalls, requestCalls };
    } catch (retryErr) {
      if (!unauthorized(retryErr)) throw retryErr;
      return {
        status: "needs_reauth",
        refreshCalls,
        requestCalls,
        reason: "unauthorized_after_refresh",
      };
    }
  }
}
