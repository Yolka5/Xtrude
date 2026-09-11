/**
 * Persistable streak snapshot from `daily_stats`. Same rule as
 * src/lib/db/derive.ts: an empty-so-far today does not break the streak;
 * the streak only breaks once a calendar day has passed with no sessions.
 *
 * The daily discovery job writes this so a missed day is recorded at
 * midnight even if nobody opens the app.
 */
import { calendarDateInZone } from "./timezone.mjs";
import { APP_USER_ID } from "./appUser.mjs";

const DAY_MS = 86_400_000;

function addDaysIso(date, days) {
  const ms = Date.parse(`${date}T12:00:00Z`) + days * DAY_MS;
  return calendarDateInZone(new Date(ms), "UTC");
}

export function streakFromDaily(dailyRows, now = new Date()) {
  const today = calendarDateInZone(now);
  const byDate = new Map((dailyRows ?? []).map((d) => [d.date, d]));

  const todayActive = (byDate.get(today)?.session_count ?? 0) > 0;
  let cursor = todayActive ? today : addDaysIso(today, -1);
  let current = 0;
  for (;;) {
    const d = byDate.get(cursor);
    if (d && d.session_count > 0) {
      current++;
      cursor = addDaysIso(cursor, -1);
    } else break;
  }

  let longest = 0;
  let run = 0;
  const dates = [...byDate.keys()].sort();
  // Walk a dense range from the first stored day through today so a gap
  // (missing daily_stats row = no sessions that day) actually breaks a run.
  if (dates.length > 0) {
    for (let d = dates[0]; d <= today; d = addDaysIso(d, 1)) {
      const row = byDate.get(d);
      run = row && row.session_count > 0 ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
  }

  return { current, longest, asOf: today, computedAt: now.toISOString() };
}

export async function snapshotStreak(supabase, now = new Date()) {
  const { data, error } = await supabase
    .from("daily_stats")
    .select("date, session_count")
    .eq("user_id", APP_USER_ID)
    .order("date", { ascending: true });
  if (error) throw new Error(`loading daily_stats for streak: ${error.message}`);
  return streakFromDaily(data ?? [], now);
}
