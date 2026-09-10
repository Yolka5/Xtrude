/**
 * Shared session-rebuild logic: `events` in, `sessions`/`daily_stats`
 * wiped and rebuilt in Supabase. Used by both `npm run recompute-sessions`
 * (a manual, one-off full recompute - always finalizes every cluster) and
 * the hourly sync cron (`excludeLiveTail: true`), which must NOT finalize
 * a cluster that's still within the idle window: the user might still be
 * editing, and closing it early would credit a session that hasn't
 * actually ended yet, then have to un-write it next hour.
 *
 * Always a full wipe-and-rebuild rather than an incremental merge, same
 * reasoning as the original recompute-sessions.mjs: at single-user,
 * few-hundred-session volume that's simpler than diffing old sessions
 * against new ones, and it's what makes this idempotent by construction.
 */
import { clusterSessions, IDLE_THRESHOLD_MINUTES } from "./sessionAlgorithm.mjs";

async function fetchAllEvents(supabase) {
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

/**
 * @param {*} supabase
 * @param {{ excludeLiveTail?: boolean, now?: Date }} [opts]
 */
export async function rebuildSessions(supabase, { excludeLiveTail = false, now = new Date() } = {}) {
  const events = await fetchAllEvents(supabase);

  let clusters = events.length ? clusterSessions(events) : [];
  let excludedLiveTail = false;
  if (excludeLiveTail && clusters.length > 0) {
    const last = clusters[clusters.length - 1];
    const idleMs = IDLE_THRESHOLD_MINUTES * 60_000;
    if (now.getTime() - new Date(last.endedAt).getTime() < idleMs) {
      clusters = clusters.slice(0, -1);
      excludedLiveTail = true;
    }
  }

  const kept = clusters.filter((c) => c.kept);
  const dropped = clusters.length - kept.length;

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

  return {
    eventCount: events.length,
    clusterCount: clusters.length,
    kept: kept.length,
    dropped,
    excludedLiveTail,
    sessionsWritten: sessionRows.length,
    activeDays: dailyRows.length,
    totalScoredMinutes: sessionRows.reduce((sum, s) => sum + s.scored_minutes, 0),
  };
}
