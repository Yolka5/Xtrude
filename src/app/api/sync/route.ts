import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runDirtySync } from "../../../../scripts/lib/runDirtySync.mjs";
import { createCallBudget, maxCallsPerRun } from "../../../../scripts/lib/callBudget.mjs";
import { lastSyncKey } from "../../../../scripts/lib/userScope.mjs";
import { requireEnv } from "@/lib/env";
import { PAGE_SYNC_MAX_AGE_MS } from "@/lib/pageSync";
import { getSessionUserId } from "@/lib/auth/currentUser";
import { onshapeClientForUser } from "@/lib/onshapeForUser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Page-load freshness: Today calls this in the background when the
 * signed-in user's own last sync is older than 15 minutes. No CRON_SECRET -
 * the browser cannot hold one - so the per-user 15-minute throttle is the
 * budget guard. Only that user's dirty documents are read, with that
 * user's own Onshape credentials: opening Today never spends another
 * account's calls or touches another account's rows. A clean run costs
 * zero Onshape calls.
 */

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });
  }

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const key = lastSyncKey(userId);
  const { data: last, error: lastErr } = await supabase
    .from("app_state")
    .select("updated_at")
    .eq("key", key)
    .maybeSingle();
  if (lastErr) {
    return NextResponse.json({ ok: false, reason: "load_failed", message: lastErr.message }, { status: 500 });
  }

  if (last?.updated_at && Date.now() - Date.parse(last.updated_at) < PAGE_SYNC_MAX_AGE_MS) {
    return NextResponse.json({ ok: true, skipped: true, reason: "throttled" });
  }

  const now = new Date();
  const budget = createCallBudget(maxCallsPerRun());
  try {
    const summary = await runDirtySync(supabase, {
      userId,
      budget,
      now,
      trigger: "page",
      getClient: () => onshapeClientForUser(userId, budget),
    });
    const stamp = now.toISOString();
    await supabase.from("app_state").upsert([
      { key, value: summary, updated_at: stamp },
      // /admin's "Last sync" card: the most recent run by anyone.
      { key: "last_sync", value: summary, updated_at: stamp },
    ]);
    let push: unknown = null;
    try {
      const { maybeSendPushReminders } = await import("@/lib/push/reminders");
      push = await maybeSendPushReminders(now);
    } catch {
      push = null;
    }
    return NextResponse.json({ ...summary, ok: summary.errors.length === 0, skipped: false, push });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, reason: "sync_failed", message }, { status: 500 });
  }
}
