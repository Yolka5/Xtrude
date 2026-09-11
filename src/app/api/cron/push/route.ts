import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized, unauthorizedCron } from "@/lib/cronAuth";
import { maybeSendPushReminders } from "@/lib/push/reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 18:00 UTC is 20:00 IST / 21:00 IDT — always past 20:00 Asia/Jerusalem,
 * which is when streak-at-risk may fire. League overtake and new badges
 * are also evaluated here (and after sync). No Onshape calls.
 */
async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) return unauthorizedCron();
  try {
    const push = await maybeSendPushReminders(new Date());
    return NextResponse.json({ ok: true, push });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, reason: "push_failed", message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
