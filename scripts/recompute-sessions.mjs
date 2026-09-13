#!/usr/bin/env node
/**
 * Recomputes `sessions` and `daily_stats` from `events`, the append-only
 * source of truth, for every user - or one, with `--user <uuid>`. Manual,
 * one-off version of the same per-user rebuild the sync and discovery crons
 * run automatically. By default it finalizes every cluster, so it's the
 * right thing to run right after changing a constant in
 * sessionAlgorithm.mjs; pass `--exclude-live-tail` to leave a session that
 * may still be in progress alone, the way the crons do. Zero Onshape calls.
 *
 * Run: npm run recompute-sessions
 *      npm run recompute-sessions -- --user <uuid> --exclude-live-tail
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

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const only = argValue("--user");
  const excludeLiveTail = process.argv.includes("--exclude-live-tail");

  const { data: users, error } = await supabase
    .from("users")
    .select("id, display_name")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`loading users: ${error.message}`);
  const targets = only ? (users ?? []).filter((u) => u.id === only) : users ?? [];
  if (only && targets.length === 0) throw new Error(`No user with id ${only}`);

  section("1. CLUSTER + REBUILD (per user)");
  console.log(
    `IDLE_THRESHOLD=${IDLE_THRESHOLD_MINUTES}m  LEAD_IN=${LEAD_IN_MINUTES}m  ` +
      `MAX_SESSION=${MAX_SESSION_HOURS}h  MIN_EVENTS=${MIN_EVENTS}  MIN_SPAN=${MIN_SPAN_MINUTES}m  ` +
      `excludeLiveTail=${excludeLiveTail}`
  );

  section("2. SUMMARY");
  for (const user of targets) {
    const result = await rebuildSessions(supabase, { excludeLiveTail, userId: user.id });
    console.log(
      `${user.display_name} (${user.id}): ${result.eventCount} event(s) -> ` +
        `${result.clusterCount} cluster(s), ${result.kept} kept, ${result.dropped} dropped -> ` +
        `${result.sessionsWritten} session(s), ${result.activeDays} active day(s), ` +
        `${(result.totalScoredMinutes / 60).toFixed(1)} h scored` +
        (result.excludedLiveTail ? " (live tail left open)" : "")
    );
  }
}

main().catch((err) => {
  console.error("\nrecompute-sessions failed:", err.message);
  process.exit(1);
});
