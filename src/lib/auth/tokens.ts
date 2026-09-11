import "server-only";
import { getSupabase } from "@/lib/db/client";
import { getAuthSecret } from "./secret";
import { decryptSecret, encryptSecret } from "./tokenCrypto";
import { refreshOnshapeToken } from "./onshape";
import { oauthReauthKey, onshapeImageKey, withOAuthAccess } from "./oauthAccess";

export async function userNeedsReauth(userId: string): Promise<boolean> {
  const { data } = await getSupabase()
    .from("app_state")
    .select("key")
    .eq("key", oauthReauthKey(userId))
    .maybeSingle();
  return Boolean(data);
}

export async function markNeedsReauth(userId: string, reason: string): Promise<void> {
  await getSupabase().from("app_state").upsert({
    key: oauthReauthKey(userId),
    value: { needsReauth: true, reason, at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  });
}

export async function clearNeedsReauth(userId: string): Promise<void> {
  await getSupabase().from("app_state").delete().eq("key", oauthReauthKey(userId));
}

export async function storedOnshapeImageUrl(userId: string): Promise<string | null> {
  const { data } = await getSupabase().from("app_state").select("value").eq("key", onshapeImageKey(userId)).maybeSingle();
  const url = (data?.value as { url?: unknown } | null)?.url;
  return typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://")) ? url : null;
}

export async function listReauthFlags(): Promise<{ userId: string; reason: string; at: string }[]> {
  const { data } = await getSupabase().from("app_state").select("key, value, updated_at").like("key", "oauth_reauth_%");
  return (data ?? []).map((row) => {
    const userId = String(row.key).replace(/^oauth_reauth_/, "");
    const value = (row.value ?? {}) as { reason?: string };
    return { userId, reason: value.reason || "refresh_failed", at: row.updated_at as string };
  });
}

export async function storeOnshapeTokens(params: {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresInSec?: number;
}): Promise<void> {
  const secret = getAuthSecret();
  if (!secret) throw new Error("AUTH_SECRET or CRON_SECRET is not set");
  const expiresAt = new Date(Date.now() + (params.expiresInSec ?? 3600) * 1000).toISOString();
  const { error } = await getSupabase().from("oauth_tokens").upsert({
    user_id: params.userId,
    access_cipher: encryptSecret(params.accessToken, secret),
    refresh_cipher: encryptSecret(params.refreshToken, secret),
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    if (/does not exist|could not find the table|schema cache/i.test(error.message)) {
      console.error("oauth_tokens table missing — run supabase/migrate-oauth.sql");
      return;
    }
    throw new Error(`storing oauth tokens: ${error.message}`);
  }
  await clearNeedsReauth(params.userId);
}

export async function storeOnshapeImage(userId: string, url: string | null): Promise<void> {
  const sb = getSupabase();
  const key = onshapeImageKey(userId);
  if (!url) {
    await sb.from("app_state").delete().eq("key", key);
    return;
  }
  await sb.from("app_state").upsert({
    key,
    value: { url },
    updated_at: new Date().toISOString(),
  });
}

/**
 * Decrypts a valid access token for server-side Onshape calls. Refreshes
 * automatically when within 5 minutes of expiry. Never returns the token
 * to the client. Failed refresh marks needs-reauth and returns null so
 * callers skip Onshape for this user until they reconnect.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const secret = getAuthSecret();
  if (!secret) return null;
  if (await userNeedsReauth(userId)) return null;

  const { data, error } = await getSupabase()
    .from("oauth_tokens")
    .select("access_cipher, refresh_cipher, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  const expiresAt = Date.parse(data.expires_at as string);
  const clientId = process.env.ONSHAPE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.ONSHAPE_OAUTH_CLIENT_SECRET;

  let refreshPlain: string;
  try {
    refreshPlain = decryptSecret(data.refresh_cipher as string, secret);
  } catch {
    await markNeedsReauth(userId, "refresh_cipher_unreadable");
    return null;
  }

  const result = await withOAuthAccess({
    needsReauth: false,
    expiresAtMs: expiresAt,
    getAccessToken: () => decryptSecret(data.access_cipher as string, secret),
    refresh: async () => {
      if (!clientId || !clientSecret) throw new Error("missing oauth app");
      const fresh = await refreshOnshapeToken({
        refreshToken: refreshPlain,
        clientId,
        clientSecret,
      });
      await storeOnshapeTokens({
        userId,
        accessToken: fresh.access_token,
        refreshToken: fresh.refresh_token || refreshPlain,
        expiresInSec: fresh.expires_in,
      });
      return { accessToken: fresh.access_token };
    },
    request: async (accessToken) => accessToken,
  });

  if (result.status === "ok") return result.value;
  if (result.status === "needs_reauth") {
    await markNeedsReauth(userId, result.reason);
  }
  return null;
}
