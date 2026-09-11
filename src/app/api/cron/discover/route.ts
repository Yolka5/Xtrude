import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { makeClient, rebuildSessions } from "@/lib/onshapeRuntime";
import { snapshotStreak } from "../../../../../scripts/lib/streakSnapshot.mjs";
import { requireEnv } from "@/lib/env";
import { cronAuthorized, unauthorizedCron } from "@/lib/cronAuth";
import { APP_USER_ID } from "../../../../../scripts/lib/appUser.mjs";
import { maybeSendPushReminders } from "@/lib/push/reminders";
import { discoveryDue } from "@/lib/discoverySchedule";
import {
  discoverForUser,
  discoveryUserKey,
  lastDiscoveredAtFromValue,
  stampUserDiscovered,
} from "@/lib/discoverDocuments";
import { getValidAccessToken, userNeedsReauth } from "@/lib/auth/tokens";
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
 * and who have credentials.
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

function makeOnshapeForUser(userId: string, budget: ReturnType<typeof createCallBudget>) {
  if (userId === APP_USER_ID && process.env.ONSHAPE_ACCESS_KEY && process.env.ONSHAPE_SECRET_KEY) {
    return makeClient({
      accessKey: process.env.ONSHAPE_ACCESS_KEY,
      secretKey: process.env.ONSHAPE_SECRET_KEY,
      budget,
    });
  }
  return null;
}

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

    if (await userNeedsReauth(userId)) {
      log.skipped = true;
      log.reason = "due but needs Onshape reauth";
      summary.users.push(log);
      continue;
    }

    let onshape = makeOnshapeForUser(userId, budget);
    if (!onshape) {
      const token = await getValidAccessToken(userId);
      if (!token) {
        log.skipped = true;
        log.reason = "due but no oauth token";
        summary.users.push(log);
        continue;
      }
      onshape = makeClient({ accessToken: token, budget });
    }

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

  try {
    const rollups = [];
    const streaks = [];
    for (const user of users) {
      const userId = user.id as string;
      rollups.push(await rebuildSessions(supabase, { excludeLiveTail: true, now, userId }));
      streaks.push(await snapshotStreak(supabase, now, userId));
    }
    summary.rollup = rollups[0] ?? null;
    summary.streak = streaks[0] ?? null;
    await supabase.from("app_state").upsert({
      key: "last_rollup",
      value: { rollup: summary.rollup, streak: summary.streak, users: users.length },
      updated_at: now.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.errors.push(`rollup: ${message}`);
  }

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
