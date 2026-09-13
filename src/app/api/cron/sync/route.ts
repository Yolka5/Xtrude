import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runDirtySync } from "../../../../../scripts/lib/runDirtySync.mjs";
import { createCallBudget, maxCallsPerRun } from "../../../../../scripts/lib/callBudget.mjs";
import { lastSyncKey } from "../../../../../scripts/lib/userScope.mjs";
import { requireEnv } from "@/lib/env";
import { cronAuthorized, unauthorizedCron } from "@/lib/cronAuth";
import { onshapeClientForUser } from "@/lib/onshapeForUser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Hourly GitHub Actions backstop (and any manual poke with CRON_SECRET).
 * For every user in turn: ingests new microversions for that user's
 * documents the webhook endpoint flagged dirty, with that user's own
 * Onshape credentials, then rebuilds that user's sessions/daily_stats with
 * the still-editing tail excluded. One call budget is shared across users.
 *
 * Vercel Hobby cannot run hourly crons, so this route is not in
 * vercel.json. GitHub Actions POSTs here every hour; the Today page uses
 * /api/sync instead (same work for the signed-in viewer only, 15-minute
 * throttle, no secret in the browser).
 */

type UserSync = {
  userId: string;
  documentsChecked: number;
  documentsSynced: number;
  eventsWritten: number;
  callsUsed: number;
  skippedReason: string | null;
  rebuild: { sessionsWritten?: number } | null;
  errors: string[];
};

async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) return unauthorizedCron();

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const now = new Date();
  const budget = createCallBudget(maxCallsPerRun());

  const { data: userRows, error: userErr } = await supabase
    .from("users")
    .select("id")
    .order("created_at", { ascending: true });
  if (userErr) {
    return NextResponse.json({ ok: false, reason: "load_users_failed", message: userErr.message }, { status: 500 });
  }

  const users: UserSync[] = [];
  const errors: string[] = [];
  for (const row of userRows ?? []) {
    const userId = row.id as string;
    try {
      const result: UserSync = await runDirtySync(supabase, {
        userId,
        budget,
        now,
        trigger: "cron",
        getClient: () => onshapeClientForUser(userId, budget),
      });
      users.push(result);
      errors.push(...result.errors.map((e) => `${userId}: ${e}`));
      await supabase.from("app_state").upsert({ key: lastSyncKey(userId), value: result, updated_at: now.toISOString() });
    } catch (err) {
      errors.push(`${userId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const total = (pick: (u: UserSync) => number) => users.reduce((sum, u) => sum + pick(u), 0);
  const summary = {
    at: now.toISOString(),
    trigger: "cron",
    documentsChecked: total((u) => u.documentsChecked),
    documentsSynced: total((u) => u.documentsSynced),
    eventsWritten: total((u) => u.eventsWritten),
    rebuild: { sessionsWritten: total((u) => u.rebuild?.sessionsWritten ?? 0) },
    callsUsed: budget.callsUsed(),
    budget: budget.snapshot(),
    users: users.map((u) => ({
      userId: u.userId,
      documentsChecked: u.documentsChecked,
      documentsSynced: u.documentsSynced,
      eventsWritten: u.eventsWritten,
      callsUsed: u.callsUsed,
      skippedReason: u.skippedReason,
    })),
    errors,
  };
  await supabase.from("app_state").upsert({ key: "last_sync", value: summary, updated_at: now.toISOString() });

  let push: unknown = null;
  try {
    const { maybeSendPushReminders } = await import("@/lib/push/reminders");
    push = await maybeSendPushReminders(now);
  } catch {
    push = null;
  }
  return NextResponse.json({ ok: errors.length === 0, ...summary, push });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
