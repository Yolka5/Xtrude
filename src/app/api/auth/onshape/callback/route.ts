import { NextRequest, NextResponse } from "next/server";
import { getAuthSecret } from "@/lib/auth/secret";
import {
  createSessionToken,
  SESSION_COOKIE,
  STATE_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth/session";
import {
  exchangeOnshapeCode,
  fetchOnshapeSessionInfo,
  onshapeCallbackUrl,
} from "@/lib/auth/onshape";
import { storeOnshapeTokens } from "@/lib/auth/tokens";
import { upsertUserFromOnshape } from "@/lib/auth/upsertUser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function fail(req: NextRequest, reason: string) {
  const url = new URL("/connect/", req.nextUrl.origin);
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const secret = getAuthSecret();
  if (!secret) return fail(req, "missing_auth_secret");

  const clientId = process.env.ONSHAPE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.ONSHAPE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail(req, "missing_oauth_app");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError) return fail(req, "denied");
  if (!code || !state) return fail(req, "missing_code");

  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== state) return fail(req, "bad_state");

  const redirectUri = onshapeCallbackUrl(req.nextUrl.origin);

  let tokens;
  try {
    tokens = await exchangeOnshapeCode({
      code,
      redirectUri,
      clientId,
      clientSecret,
    });
  } catch {
    return fail(req, "token_exchange");
  }

  let profile;
  try {
    profile = await fetchOnshapeSessionInfo(tokens.access_token);
  } catch {
    return fail(req, "sessioninfo");
  }

  let user;
  try {
    user = await upsertUserFromOnshape(profile);
  } catch (err) {
    console.error("upsert user failed:", err instanceof Error ? err.message : err);
    return fail(req, "user");
  }

  try {
    await storeOnshapeTokens({
      userId: user.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresInSec: tokens.expires_in,
    });
  } catch (err) {
    console.error("store tokens failed:", err instanceof Error ? err.message : err);
    return fail(req, "token_store");
  }

  const session = await createSessionToken(user.id, secret);
  const dest = new URL(user.created ? "/?onboarded=1" : "/", req.nextUrl.origin);
  const res = NextResponse.redirect(dest);
  res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions(req.nextUrl.protocol === "https:"));
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
