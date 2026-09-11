import "server-only";

export const ONSHAPE_AUTHORIZE_URL = "https://oauth.onshape.com/oauth/authorize";
export const ONSHAPE_TOKEN_URL = "https://oauth.onshape.com/oauth/token";
export const ONSHAPE_SCOPES = "OAuth2ReadPII OAuth2Read";

export function onshapeCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/auth/onshape/callback`;
}

export type OnshapeTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
};

export async function exchangeOnshapeCode(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<OnshapeTokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });
}

export async function refreshOnshapeToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<OnshapeTokenResponse> {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
  });
}

async function tokenRequest(body: Record<string, string>): Promise<OnshapeTokenResponse> {
  const res = await fetch(ONSHAPE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Onshape token endpoint HTTP ${res.status}`);
  }
  const json = JSON.parse(text) as OnshapeTokenResponse;
  if (!json.access_token || !json.refresh_token) {
    throw new Error("Onshape token response missing access or refresh token");
  }
  return json;
}

export type OnshapeSessionInfo = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

/**
 * Costs 1 Onshape API call. 4xx/5xx do not count against the annual quota;
 * a 200 does.
 */
export async function fetchOnshapeSessionInfo(accessToken: string): Promise<OnshapeSessionInfo> {
  const res = await fetch("https://cad.onshape.com/api/users/sessioninfo", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`sessioninfo HTTP ${res.status}`);
  }
  const json = (await res.json()) as OnshapeSessionInfo;
  if (!json?.id) throw new Error("sessioninfo missing id");
  return json;
}

export function displayNameFromSession(info: OnshapeSessionInfo): string {
  const combined = [info.firstName, info.lastName].filter(Boolean).join(" ").trim();
  return (info.name || combined || "Onshape user").slice(0, 80);
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return (name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2) || "??").toUpperCase();
}
