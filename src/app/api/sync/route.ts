import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runDirtySync } from "../../../../scripts/lib/runDirtySync.mjs";
import { requireEnv } from "@/lib/env";
import { PAGE_SYNC_MAX_AGE_MS } from "@/lib/pageSync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Page-load freshness: Today calls this in the background when last_sync
 * is older than 15 minutes. No CRON_SECRET - the browser cannot hold one -
 * so the 15-minute throttle is the budget guard. Dirty documents still
 * cost one documenthistory call each; a throttled or clean run costs zero.
 */

export async function POST() {
  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const { data: last, error: lastErr } = await supabase
    .from("app_state")
    .select("updated_at")
    .eq("key", "last_sync")
    .maybeSingle();
  if (lastErr) {
    return NextResponse.json({ ok: false, reason: "load_failed", message: lastErr.message }, { status: 500 });
  }

  if (last?.updated_at && Date.now() - Date.parse(last.updated_at) < PAGE_SYNC_MAX_AGE_MS) {
    return NextResponse.json({ ok: true, skipped: true, reason: "throttled" });
  }

  try {
    const summary = await runDirtySync(supabase, {
      accessKey: requireEnv("ONSHAPE_ACCESS_KEY"),
      secretKey: requireEnv("ONSHAPE_SECRET_KEY"),
      trigger: "page",
    });
    let push: unknown = null;
    try {
      const { maybeSendPushReminders } = await import("@/lib/push/reminders");
      push = await maybeSendPushReminders(new Date());
    } catch {
      push = null;
    }
    return NextResponse.json({ ok: summary.errors.length === 0, skipped: false, ...summary, push });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, reason: "sync_failed", message }, { status: 500 });
  }
}
