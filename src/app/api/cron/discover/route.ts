import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rebuildSessions } from "@/lib/onshapeRuntime";
import { snapshotStreak } from "../../../../../scripts/lib/streakSnapshot.mjs";
import { requireEnv } from "@/lib/env";
import { cronAuthorized, unauthorizedCron } from "@/lib/cronAuth";
import { maybeSendPushReminders } from "@/lib/push/reminders";
import { discoveryDue } from "@/lib/discoverySchedule";
import {
  discoverForUser,
  discoveryUserKey,
  lastDiscoveredAtFromValue,
  stampUserDiscovered,
} from "@/lib/discoverDocuments";
import { onshapeClientForUser } from "@/lib/onshapeForUser";
import { createCallBudget, isBudgetExceeded, maxCallsPerRun } from "../../../../../scripts/lib/callBudget.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily Vercel Cron (22:00 UTC): the only entry point for document
 * discovery after connect-time onboarding. App opens do not trigger this.
 *
 * Per user, from recorded sessions (zero Onshape calls to decide):
 *   - any session in the last 7 local days → discover daily
 *   - otherwise → discover weekly
 * First-discovery backfill (last_backfilled_at null → documenthistory)
 * is unchanged inside discoverForUser.
 *
 * Session rebuild + streak snapshot run for every user every night (DB
 * only). Onshape list/history/webhook calls run only for users who are due
 * and who have credentials of their own.
 */

type UserLog = {
  userId: string;
  due: boolean;
  skipped: boolean;
  cadence: string;
  reason: string;
  documentsSeen: number;
  documentsAdded: number;
  documentsBackfilled: number;
  webhooksRegistered: number;
  callsUsed: number;
};

async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) return unauthorizedCron();

  const webhookUrl = requireEnv("WEBHOOK_URL");
  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const now = new Date();
  const summary = {
    at: now.toISOString(),
    documentsSeen: 0,
    documentsAdded: 0,
    documentsBackfilled: 0,
    backfillEventsWritten: 0,
    webhooksRegistered: 0,
    errors: [] as string[],
    callsUsed: 0,
    budget: null as unknown,
    rollup: null as unknown,
    streak: null as unknown,
    users: [] as UserLog[],
  };

  const { data: userRows, error: userErr } = await supabase.from("users").select("id");
  if (userErr) {
    summary.errors.push(`loading users: ${userErr.message}`);
  }
  const users = userRows ?? [];
  const budget = createCallBudget(maxCallsPerRun());
  summary.budget = budget.snapshot();

  for (const user of users) {
    const userId = user.id as string;
    const [{ data: sess }, { data: discRow }] = await Promise.all([
      supabase
        .from("sessions")
        .select("started_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(1),
      supabase.from("app_state").select("value").eq("key", discoveryUserKey(userId)).maybeSingle(),
    ]);
    const decision = discoveryDue({
      now,
      lastSessionAt: sess?.[0]?.started_at ?? null,
      lastDiscoveredAt: lastDiscoveredAtFromValue(discRow?.value),
    });

    const log: UserLog = {
      userId,
      due: decision.due,
      skipped: !decision.due,
      cadence: decision.cadence,
      reason: decision.reason,
      documentsSeen: 0,
      documentsAdded: 0,
      documentsBackfilled: 0,
      webhooksRegistered: 0,
      callsUsed: 0,
    };

    if (!decision.due) {
      summary.users.push(log);
      continue;
    }

    if (budget.remaining() < 1) {
      log.skipped = true;
      log.reason = `due but Onshape budget exhausted this run (${budget.callsUsed()}/${budget.maxCalls} at ${budget.stoppedAt() ?? "cap"})`;
      summary.users.push(log);
      continue;
    }

    const credentials = await onshapeClientForUser(userId, budget);
    if (credentials.client === null) {
      log.skipped = true;
      log.reason = credentials.reason === "needs_reauth" ? "due but needs Onshape reauth" : "due but no oauth token";
      summary.users.push(log);
      continue;
    }
    const onshape = credentials.client;

    const startedCalls = onshape.callsUsed();
    try {
      const result = await discoverForUser(supabase, onshape, userId, webhookUrl, now);
      log.documentsSeen = result.documentsSeen;
      log.documentsAdded = result.documentsAdded;
      log.documentsBackfilled = result.documentsBackfilled;
      log.webhooksRegistered = result.webhooksRegistered;
      log.callsUsed = result.callsUsed - startedCalls;
      log.skipped = false;
      summary.documentsSeen += result.documentsSeen;
      summary.documentsAdded += result.documentsAdded;
      summary.documentsBackfilled += result.documentsBackfilled;
      summary.backfillEventsWritten += result.backfillEventsWritten;
      summary.webhooksRegistered += result.webhooksRegistered;
      summary.errors.push(...result.errors.map((e) => `${userId}: ${e}`));
      await stampUserDiscovered(supabase, userId, now, {
        source: "cron",
        cadence: decision.cadence,
        reason: decision.reason,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${userId}: ${message}`);
      log.reason = `${decision.reason}; error: ${message}`;
      if (isBudgetExceeded(err)) log.skipped = true;
    }
    const used = onshape.callsUsed() - startedCalls;
    summary.callsUsed = budget.callsUsed();
    log.callsUsed = used;
    summary.users.push(log);
  }

  summary.budget = budget.snapshot();

  // Every user separately, so one account that cannot rebuild never stops
  // the others' sessions and streaks from updating.
  const rollups: unknown[] = [];
  const streaks: unknown[] = [];
  for (const user of users) {
    const userId = user.id as string;
    try {
      rollups.push(await rebuildSessions(supabase, { excludeLiveTail: true, now, userId }));
      streaks.push(await snapshotStreak(supabase, now, userId));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(`rollup ${userId}: ${message}`);
    }
  }
  summary.rollup = rollups[0] ?? null;
  summary.streak = streaks[0] ?? null;
  await supabase.from("app_state").upsert({
    key: "last_rollup",
    value: { rollup: summary.rollup, streak: summary.streak, users: users.length },
    updated_at: now.toISOString(),
  });

  try {
    (summary as { push?: unknown }).push = await maybeSendPushReminders(now);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.errors.push(`push: ${message}`);
  }
  await supabase.from("app_state").upsert({ key: "last_discovery", value: summary, updated_at: now.toISOString() });

  return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
