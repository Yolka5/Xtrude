import { NextRequest, NextResponse } from "next/server";

/** Shared gate for /api/cron/* - Vercel Cron and GitHub Actions both send
 * `Authorization: Bearer $CRON_SECRET`. If CRON_SECRET is unset the route
 * accepts anyone; that is only acceptable locally, never on Vercel. */
export function unauthorizedCron(): NextResponse {
  return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
}

export function cronAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // On Vercel, an unset secret would otherwise leave the cron routes open
  // to the internet (and to Onshape-call spend). Locally, unset still
  // means "open" so `next dev` can poke them without extra setup.
  if (!cronSecret) return !process.env.VERCEL;
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}
