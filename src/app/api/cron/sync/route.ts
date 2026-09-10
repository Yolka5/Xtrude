import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runDirtySync } from "../../../../../scripts/lib/runDirtySync.mjs";
import { requireEnv } from "@/lib/env";
import { cronAuthorized, unauthorizedCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Hourly GitHub Actions backstop (and any manual poke with CRON_SECRET).
 * Ingests new microversions for documents the webhook endpoint flagged
 * dirty, then rebuilds sessions/daily_stats with the still-editing tail
 * excluded.
 *
 * Vercel Hobby cannot run hourly crons, so this route is not in
 * vercel.json. GitHub Actions POSTs here every hour; the Today page uses
 * /api/sync instead (same work, 15-minute throttle, no secret in the
 * browser).
 */

async function handle(req: NextRequest) {
  if (!cronAuthorized(req)) return unauthorizedCron();

  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  try {
    const summary = await runDirtySync(supabase, {
      accessKey: requireEnv("ONSHAPE_ACCESS_KEY"),
      secretKey: requireEnv("ONSHAPE_SECRET_KEY"),
      trigger: "cron",
    });
    return NextResponse.json({ ok: summary.errors.length === 0, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, reason: "sync_failed", message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
