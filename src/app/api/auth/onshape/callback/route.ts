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
import { storeOnshapeTokens, storeOnshapeImage } from "@/lib/auth/tokens";
import { upsertUserFromOnshape } from "@/lib/auth/upsertUser";
import { maybeOnboardUser } from "@/lib/onboarding";
import { joinLeagueByCode } from "@/lib/db/leagues";
import { INVITE_COOKIE, invitePath, parseInviteCode } from "@/lib/invite";
import { profileImageUrlFromSession } from "@/lib/profileFields";
import { getHandleForUser } from "@/lib/db/handles";

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
    await storeOnshapeImage(user.id, profileImageUrlFromSession(profile));
  } catch (err) {
    console.error("store tokens failed:", err instanceof Error ? err.message : err);
    return fail(req, "token_store");
  }

  let onboarded = user.created;
  try {
    const onboard = await maybeOnboardUser(user.id);
    if (onboard) {
      onboarded = true;
      console.log(
        `onboard user ${user.id}: docs=${onboard.documentsAdded} history=${onboard.historiesPulled} webhooks=${onboard.webhooksRegistered} calls=${onboard.callsUsed} errors=${onboard.errors.length}`
      );
    }
  } catch (err) {
    console.error("onboarding failed:", err instanceof Error ? err.message : err);
  }

  const session = await createSessionToken(user.id, secret);
  const invite = parseInviteCode(req.cookies.get(INVITE_COOKIE)?.value);
  let dest = new URL(onboarded ? "/?onboarded=1" : "/", req.nextUrl.origin);
  if (invite) {
    try {
      const joined = await joinLeagueByCode(user.id, invite);
      dest = new URL(`/league/?league=${joined.id}`, req.nextUrl.origin);
    } catch {
      dest = new URL(invitePath(invite), req.nextUrl.origin);
    }
  }
  const existingHandle = await getHandleForUser(user.id);
  if (!existingHandle) {
    const welcome = new URL("/welcome/", req.nextUrl.origin);
    welcome.searchParams.set("next", `${dest.pathname}${dest.search}`);
    dest = welcome;
  }
  const res = NextResponse.redirect(dest);
  res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions(req.nextUrl.protocol === "https:"));
  res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(INVITE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
