#!/usr/bin/env node
/**
 * Recomputes `sessions` and `daily_stats` from `events`, the append-only
 * source of truth. Always a full wipe-and-rebuild rather than an
 * incremental merge - at single-user, few-hundred-session volume that's
 * simpler than diffing old sessions against new ones, and it's what makes
 * this idempotent almost by construction: the same events in always
 * produce the same rows out, whether this is the first run or the
 * hundredth, and after changing a constant in sessionAlgorithm.mjs this is
 * the one command that re-derives all of history under the new rule.
 *
 * Run: npm run recompute-sessions
 *
 * Calendar days for daily_stats are bucketed by each session's start time
 * in UTC. Onshape returns UTC and this script has no notion of "your local
 * day" - if that ever matters for display (e.g. a session that starts just
 * before local midnight), it's a UI-layer concern, not this script's.
 */
import { loadEnv, requireEnv } from "./lib/env.mjs";
import { createClient } from "@supabase/supabase-js";
import { clusterSessions, IDLE_THRESHOLD_MINUTES, LEAD_IN_MINUTES, MAX_SESSION_HOURS, MIN_EVENTS, MIN_SPAN_MINUTES } from "./lib/sessionAlgorithm.mjs";

loadEnv();

function section(title) {
  console.log();
  console.log("=".repeat(78));
  console.log(title);
  console.log("=".repeat(78));
}

async function fetchAllEvents(supabase) {
  // documents(onshape_document_id) reads the FK to tracked_documents, so
  // each event comes back already carrying the document's external id -
  // sessions.document_ids stores that, not the internal uuid, since it's
  // what everything downstream (the UI, any future Onshape API call) wants.
  const PAGE = 1000;
  const events = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("events")
      .select("occurred_at, tracked_documents(onshape_document_id)")
      .order("occurred_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`fetching events: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const row of data) {
      events.push({
        occurred_at: row.occurred_at,
        document_id: row.tracked_documents?.onshape_document_id ?? "unknown",
      });
    }
    if (data.length < PAGE) break;
  }
  return events;
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  section("1. LOAD EVENTS");
  const events = await fetchAllEvents(supabase);
  console.log(`${events.length} event(s) loaded.`);
  if (events.length === 0) {
    console.log("Nothing to compute. Run the backfill first: npm run backfill");
    return;
  }

  section("2. CLUSTER");
  console.log(
    `IDLE_THRESHOLD=${IDLE_THRESHOLD_MINUTES}m  LEAD_IN=${LEAD_IN_MINUTES}m  ` +
      `MAX_SESSION=${MAX_SESSION_HOURS}h  MIN_EVENTS=${MIN_EVENTS}  MIN_SPAN=${MIN_SPAN_MINUTES}m`
  );
  const clusters = clusterSessions(events);
  const kept = clusters.filter((c) => c.kept);
  const dropped = clusters.length - kept.length;
  console.log(
    `${clusters.length} raw cluster(s) -> ${kept.length} kept, ${dropped} dropped ` +
      `(< ${MIN_EVENTS} events or < ${MIN_SPAN_MINUTES}m span).`
  );

  const sessionRows = kept.map((s) => ({
    started_at: s.startedAt,
    ended_at: s.endedAt,
    duration_seconds: Math.round(s.durationSeconds),
    event_count: s.eventCount,
    raw_minutes: Math.round((s.spanSeconds / 60) * 100) / 100,
    scored_minutes: Math.round((s.durationSeconds / 60) * 100) / 100,
    document_ids: s.documentIds,
  }));

  const dailyMap = new Map(); // date string -> { total_scored_minutes, session_count }
  for (const row of sessionRows) {
    const date = row.started_at.slice(0, 10); // UTC calendar date
    const entry = dailyMap.get(date) ?? { total_scored_minutes: 0, session_count: 0 };
    entry.total_scored_minutes += row.scored_minutes;
    entry.session_count += 1;
    dailyMap.set(date, entry);
  }
  const dailyRows = [...dailyMap.entries()].map(([date, v]) => ({
    date,
    total_scored_minutes: Math.round(v.total_scored_minutes * 100) / 100,
    session_count: v.session_count,
  }));

  section("3. REBUILD");
  const { error: delSessionsErr } = await supabase.from("sessions").delete().gte("started_at", "1900-01-01");
  if (delSessionsErr) throw new Error(`clearing sessions: ${delSessionsErr.message}`);
  const { error: delDailyErr } = await supabase.from("daily_stats").delete().gte("date", "1900-01-01");
  if (delDailyErr) throw new Error(`clearing daily_stats: ${delDailyErr.message}`);

  const CHUNK = 500;
  for (let i = 0; i < sessionRows.length; i += CHUNK) {
    const { error } = await supabase.from("sessions").insert(sessionRows.slice(i, i + CHUNK));
    if (error) throw new Error(`inserting sessions: ${error.message}`);
  }
  for (let i = 0; i < dailyRows.length; i += CHUNK) {
    const { error } = await supabase.from("daily_stats").insert(dailyRows.slice(i, i + CHUNK));
    if (error) throw new Error(`inserting daily_stats: ${error.message}`);
  }

  section("4. SUMMARY");
  const totalMinutes = sessionRows.reduce((sum, s) => sum + s.scored_minutes, 0);
  const activeDays = dailyRows.length;
  console.log(`sessions written    : ${sessionRows.length}`);
  console.log(`active days         : ${activeDays}`);
  console.log(`total scored time   : ${(totalMinutes / 60).toFixed(1)} h`);
  if (sessionRows.length > 0) {
    const first = sessionRows[0].started_at.slice(0, 10);
    const last = sessionRows[sessionRows.length - 1].started_at.slice(0, 10);
    console.log(`date range          : ${first} -> ${last}`);
  }
}

main().catch((err) => {
  console.error("\nrecompute-sessions failed:", err.message);
  process.exit(1);
});
