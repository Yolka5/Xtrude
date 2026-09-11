/**
 * Persistable streak snapshot from `daily_stats`. Same rule as
 * scripts/lib/streakMath.mjs / derive.ts: >= 10 scored minutes counts,
 * freezes auto-spend on a missed past day, empty-so-far today does not break.
 */
import { calendarDateInZone } from "./timezone.mjs";
import { APP_USER_ID } from "./appUser.mjs";
import { addDaysIso, computeStreakAndFreezes } from "./streakMath.mjs";

export function streakFromDaily(dailyRows, now = new Date()) {
  const today = calendarDateInZone(now);
  const byDate = new Map((dailyRows ?? []).map((d) => [d.date, d]));
  const dates = [...byDate.keys()].sort();
  const daily = [];
  if (dates.length > 0) {
    for (let d = dates[0]; d <= today; d = addDaysIso(d, 1)) {
      const row = byDate.get(d);
      daily.push({
        date: d,
        scoredMinutes: row ? Number(row.total_scored_minutes ?? row.scoredMinutes ?? 0) : 0,
      });
    }
  }
  const streak = computeStreakAndFreezes(daily, today);
  return { ...streak, asOf: today, computedAt: now.toISOString() };
}

export async function snapshotStreak(supabase, now = new Date(), userId = APP_USER_ID) {
  const { data, error } = await supabase
    .from("daily_stats")
    .select("date, session_count, total_scored_minutes")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  if (error) throw new Error(`loading daily_stats for streak: ${error.message}`);
  return streakFromDaily(data ?? [], now);
}
