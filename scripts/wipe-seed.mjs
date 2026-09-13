#!/usr/bin/env node
/**
 * One-time reset: deletes every row from `events`, `sessions`, and
 * `daily_stats`, leaving `tracked_documents` untouched. Xtrude tracks from
 * the day you connect it - the original 50-row-per-document backfill ceiling
 * inflated lifetime numbers past what the complete history actually
 * supports, and a stats app should never show numbers nobody earned. This
 * throws them out rather than trying to correct them in place.
 *
 * Irreversible: there is no undo short of re-running the backfill (which
 * will hit the same 50-row ceiling on history) - it only ever deletes
 * derived/append-only rows, never tracked_documents, so re-running the
 * backfill afterwards still works from the same document list.
 *
 * Run:
 *   npm run wipe-seed              # dry run: prints row counts, deletes nothing
 *   npm run wipe-seed -- --yes     # the real thing
 */
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { createClient } from "@supabase/supabase-js";
import { API_KEY_OWNER_ID } from "./lib/appUser.mjs";

loadEnv();

const CONFIRMED = process.argv.includes("--yes");

function section(title) {
  console.log();
  console.log("=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

async function count(supabase, table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq("user_id", API_KEY_OWNER_ID);
  if (error) throw new Error(`counting ${table}: ${error.message}`);
  return count ?? 0;
}

async function wipe(supabase, table) {
  const { error } = await supabase.from(table).delete().eq("user_id", API_KEY_OWNER_ID);
  if (error) throw new Error(`deleting from ${table}: ${error.message}`);
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  section("1. CURRENT STATE");
  const before = {
    events: await count(supabase, "events"),
    sessions: await count(supabase, "sessions"),
    daily_stats: await count(supabase, "daily_stats"),
    tracked_documents: await count(supabase, "tracked_documents"),
  };
  console.log(`events             : ${before.events}`);
  console.log(`sessions           : ${before.sessions}`);
  console.log(`daily_stats        : ${before.daily_stats}`);
  console.log(`tracked_documents  : ${before.tracked_documents}  (kept, not touched)`);

  if (!CONFIRMED) {
    section("DRY RUN");
    console.log("Nothing deleted. Rerun with --yes to actually wipe events, sessions, and daily_stats.");
    return;
  }

  section("2. WIPE");
  console.log("Deleting events...");
  await wipe(supabase, "events");
  console.log("Deleting sessions...");
  await wipe(supabase, "sessions");
  console.log("Deleting daily_stats...");
  await wipe(supabase, "daily_stats");

  section("3. CONFIRM");
  const after = {
    events: await count(supabase, "events"),
    sessions: await count(supabase, "sessions"),
    daily_stats: await count(supabase, "daily_stats"),
    tracked_documents: await count(supabase, "tracked_documents"),
  };
  console.log(`events             : ${after.events}`);
  console.log(`sessions           : ${after.sessions}`);
  console.log(`daily_stats        : ${after.daily_stats}`);
  console.log(`tracked_documents  : ${after.tracked_documents}  (unchanged)`);

  if (after.events !== 0 || after.sessions !== 0 || after.daily_stats !== 0) {
    throw new Error("Wipe did not fully clear one or more tables - check RLS/permissions above.");
  }
  if (after.tracked_documents !== before.tracked_documents) {
    throw new Error("tracked_documents changed - it should never have been touched.");
  }

  console.log();
  console.log("Wiped clean. Next: npm run backfill (re-pulls from the same tracked documents),");
  console.log("then npm run recompute-sessions.");
}

main().catch((err) => {
  console.error("\nwipe-seed failed:", err.message);
  process.exit(1);
});
