import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { onshapeCallbackUrl, ONSHAPE_AUTHORIZE_URL, ONSHAPE_SCOPES } from "@/lib/auth/onshape";
import { STATE_COOKIE } from "@/lib/auth/session";
import { INVITE_COOKIE, inviteCodeFromNext, inviteCookieOptions } from "@/lib/invite";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = process.env.ONSHAPE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "ONSHAPE_OAUTH_CLIENT_ID is not set" }, { status: 500 });
  }

  const state = randomBytes(32).toString("base64url");
  const origin = req.nextUrl.origin;
  const redirectUri = onshapeCallbackUrl(origin);

  const url = new URL(ONSHAPE_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", ONSHAPE_SCOPES);
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https"),
    path: "/",
    maxAge: 10 * 60,
  });
  const invite = inviteCodeFromNext(req.nextUrl.searchParams.get("next"));
  if (invite) {
    res.cookies.set(INVITE_COOKIE, invite, inviteCookieOptions(origin.startsWith("https")));
  }
  return res;
}
