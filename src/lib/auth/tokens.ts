import "server-only";
import { getSupabase } from "@/lib/db/client";
import { getAuthSecret } from "./secret";
import { decryptSecret, encryptSecret } from "./tokenCrypto";
import { refreshOnshapeToken } from "./onshape";

const REFRESH_SKEW_MS = 5 * 60 * 1000;

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
}

/**
 * Decrypts a valid access token for server-side Onshape calls. Refreshes
 * automatically when within 5 minutes of expiry. Never returns the token
 * to the client.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const secret = getAuthSecret();
  if (!secret) return null;
  const { data, error } = await getSupabase()
    .from("oauth_tokens")
    .select("access_cipher, refresh_cipher, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;

  const expiresAt = Date.parse(data.expires_at as string);
  try {
    if (Number.isFinite(expiresAt) && expiresAt - Date.now() > REFRESH_SKEW_MS) {
      return decryptSecret(data.access_cipher as string, secret);
    }
  } catch {
    return null;
  }

  const clientId = process.env.ONSHAPE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.ONSHAPE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  let refreshPlain: string;
  try {
    refreshPlain = decryptSecret(data.refresh_cipher as string, secret);
  } catch {
    return null;
  }

  try {
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
    return fresh.access_token;
  } catch (err) {
    console.error("Onshape token refresh failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
