#!/usr/bin/env node
/**
 * Recomputes `sessions` and `daily_stats` from `events`, the append-only
 * source of truth. Manual, one-off, always-finalize version of the same
 * rebuild the hourly sync cron runs automatically (see
 * src/app/api/cron/sync/route.ts) - this one never excludes a live tail
 * cluster, so it's the right thing to run right after changing a constant
 * in sessionAlgorithm.mjs and wanting every session re-scored immediately.
 *
 * Run: npm run recompute-sessions
 *
 * Calendar days for daily_stats are bucketed by each session's start time
 * in Asia/Jerusalem. Timestamps stay UTC in the database; only the grouping
 * date is converted.
 */
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { createClient } from "@supabase/supabase-js";
import { IDLE_THRESHOLD_MINUTES, LEAD_IN_MINUTES, MAX_SESSION_HOURS, MIN_EVENTS, MIN_SPAN_MINUTES } from "./lib/sessionAlgorithm.mjs";
import { rebuildSessions } from "./lib/sessionRebuild.mjs";

loadEnv();

function section(title) {
  console.log();
  console.log("=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  section("1. CLUSTER + REBUILD");
  console.log(
    `IDLE_THRESHOLD=${IDLE_THRESHOLD_MINUTES}m  LEAD_IN=${LEAD_IN_MINUTES}m  ` +
      `MAX_SESSION=${MAX_SESSION_HOURS}h  MIN_EVENTS=${MIN_EVENTS}  MIN_SPAN=${MIN_SPAN_MINUTES}m`
  );

  const result = await rebuildSessions(supabase, { excludeLiveTail: false });

  if (result.eventCount === 0) {
    console.log("No events found. Nothing to compute. Run the backfill first: npm run backfill");
    return;
  }

  console.log(
    `${result.clusterCount} raw cluster(s) -> ${result.kept} kept, ${result.dropped} dropped ` +
      `(< ${MIN_EVENTS} events or < ${MIN_SPAN_MINUTES}m span).`
  );

  section("2. SUMMARY");
  console.log(`events read         : ${result.eventCount}`);
  console.log(`sessions written    : ${result.sessionsWritten}`);
  console.log(`active days         : ${result.activeDays}`);
  console.log(`total scored time   : ${(result.totalScoredMinutes / 60).toFixed(1)} h`);
}

main().catch((err) => {
  console.error("\nrecompute-sessions failed:", err.message);
  process.exit(1);
});
