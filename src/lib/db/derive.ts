/**
 * Pure derivation: raw `sessions`/`daily_stats` rows in, everything the
 * Today/Sessions/Profile screens need out. No Supabase import, no
 * `server-only` - deliberately importable from a plain script (see
 * scratch-verify.ts) so the actual logic can be checked against synthetic
 * data, not only ever exercised live against a real project.
 *
 * Mirrors the derivations in scripts/gen-fixtures.mjs (current/longest
 * streak, Monday-anchored week, personal records, badge claims) so
 * switching from fixtures to real data changes where the numbers come
 * from, not what they mean.
 *
 * One deliberate deviation: gen-fixtures.mjs's "current streak" breaks to 0
 * the instant TODAY itself has no session yet, which is fine for a frozen
 * fixture (TODAY was always chosen to already have activity) but would zero
 * a live user's streak every morning before they've opened Onshape - here,
 * an empty-so-far today doesn't break the streak, it just isn't counted
 * yet; the streak only breaks once a day passes with nothing at all.
 */
import type {
  Session,
  TouchedDocument,
  DayTotal,
  WeekDay,
  TodayStats,
  StreakStats,
  ProfileStats,
  PersonalRecord,
  Badge,
} from "@/lib/fixtures";
import { calendarDateInZone, clockHmInZone, isAfterMidnightWindow } from "../../../scripts/lib/timezone.mjs";
import { computeStreakAndFreezes, QUALIFYING_MINUTES } from "../../../scripts/lib/streakMath.mjs";

const DAY_MS = 86_400_000;

function addDaysIso(date: string, days: number): string {
  const ms = Date.parse(`${date}T12:00:00Z`) + days * DAY_MS;
  return calendarDateInZone(new Date(ms), "UTC");
}

/** Monday=0 .. Sunday=6 for a civil YYYY-MM-DD (timezone-independent). */
function mondayIndexedDowFromDate(isoDate: string): number {
  return (new Date(`${isoDate}T12:00:00Z`).getUTCDay() + 6) % 7;
}

export interface RealData {
  hasAnyData: boolean;
  today: string;
  sessions: Session[]; // newest first
  daily: DayTotal[]; // dense, oldest first
  week: WeekDay[];
  todayStats: TodayStats;
  streak: StreakStats;
  profile: ProfileStats;
  records: PersonalRecord[];
  badges: Badge[];
}

export interface RawSessionRow {
  id: string;
  started_at: string;
  ended_at: string;
  raw_minutes: number;
  scored_minutes: number;
  event_count: number;
  document_ids: string[];
}
export interface RawDailyRow {
  date: string;
  total_scored_minutes: number;
  session_count: number;
}

export function deriveRealData(
  sessionRows: RawSessionRow[],
  dailyRows: RawDailyRow[],
  docNameById: Map<string, string>,
  todayMs: number
): RealData {
  const today = calendarDateInZone(todayMs);

  const sessions: Session[] = sessionRows.map((row) => {
    const start = new Date(row.started_at);
    const end = new Date(row.ended_at);
    const documents: TouchedDocument[] = row.document_ids.map((id) => ({
      name: docNameById.get(id) ?? "Unknown document",
      // Onshape's documenthistory rows don't carry which tab (Part Studio /
      // Assembly / Drawing) an edit landed in without an extra API call per
      // element - not spent, given the quota this backfill runs under. Blank
      // reads as nothing in the UI rather than a fabricated guess.
      tab: "",
      edits: 0,
    }));
    return {
      id: row.id,
      date: calendarDateInZone(start),
      start: clockHmInZone(start),
      end: clockHmInZone(end),
      rawMinutes: Math.round(row.raw_minutes),
      scoredMinutes: Math.round(row.scored_minutes),
      leadInMinutes: 5,
      eventCount: row.event_count,
      // No geometry verification in Phase 1 (would cost ~2 Onshape calls per
      // session, unaffordable against the 2,500/year quota) - every real
      // session is honestly unverified rather than a fabricated checkmark.
      verified: false,
      documents,
    };
  });

  const hasAnyData = sessions.length > 0;

  // Dense day-by-day series, oldest first, zero-filled gaps - the heatmap
  // and streak math both need every calendar day present, not just the ones
  // with a daily_stats row.
  const dbDaily = new Map(dailyRows.map((d) => [d.date, d]));
  const firstDate = dailyRows[0]?.date ?? today;
  const daily: DayTotal[] = [];
  for (let d = firstDate; d <= today; d = addDaysIso(d, 1)) {
    const row = dbDaily.get(d);
    daily.push({
      date: d,
      scoredMinutes: row ? Math.round(row.total_scored_minutes) : 0,
      sessions: row ? row.session_count : 0,
    });
  }
  const byDate = new Map(daily.map((d) => [d.date, d]));

  const {
    current: currentStreak,
    longest: longestStreak,
    freezeBank,
    freezeUsedDates,
    lastFreezeUsed,
  } = computeStreakAndFreezes(
    daily.map((d) => ({ date: d.date, scoredMinutes: d.scoredMinutes })),
    today
  );

  // --- this week, Monday-anchored in Asia/Jerusalem civil dates -------------
  const mondayOffset = mondayIndexedDowFromDate(today);
  const weekStart = addDaysIso(today, -mondayOffset);
  const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const week: WeekDay[] = LABELS.map((label, i) => {
    const date = addDaysIso(weekStart, i);
    const d = byDate.get(date) ?? { date, scoredMinutes: 0, sessions: 0 };
    return {
      label,
      date: d.date,
      scoredMinutes: d.scoredMinutes,
      sessions: d.sessions,
      isToday: d.date === today,
      isFuture: date > today,
    };
  });
  const weekMinutes = week.reduce((a, d) => a + d.scoredMinutes, 0);

  const lastWeekStart = addDaysIso(weekStart, -7);
  const lastWeekMinutes = LABELS.reduce((sum, _label, i) => {
    const date = addDaysIso(lastWeekStart, i);
    return sum + (byDate.get(date)?.scoredMinutes ?? 0);
  }, 0);

  // --- today ------------------------------------------------------------------
  const todayEntry = byDate.get(today) ?? { date: today, scoredMinutes: 0, sessions: 0 };
  const todayEvents = sessions.filter((s) => s.date === today).reduce((a, s) => a + s.eventCount, 0);
  const todayStats: TodayStats = {
    scoredMinutes: todayEntry.scoredMinutes,
    sessions: todayEntry.sessions,
    events: todayEvents,
  };

  // --- lifetime / profile -----------------------------------------------------
  const lifetimeMinutes = daily.reduce((a, d) => a + d.scoredMinutes, 0);
  const activeDays = daily.filter((d) => d.sessions > 0).length;
  const sortedDurations = sessions.map((s) => s.scoredMinutes).sort((a, b) => a - b);
  const medianSessionMinutes = sortedDurations.length
    ? sortedDurations[Math.floor(sortedDurations.length / 2)]
    : 0;

  // "Since" the earliest tracked activity - there's no account-creation date
  // to source this from otherwise, single-user with no auth system.
  const memberSince = hasAnyData
    ? new Date(`${daily[0].date}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "-";

  const profile: ProfileStats = {
    name: "You",
    handle: "",
    initials: "",
    memberSince,
    lifetimeMinutes,
    lifetimeHours: Math.round((lifetimeMinutes / 60) * 10) / 10,
    totalSessions: sessions.length,
    activeDays,
    longestStreak,
    currentStreak,
    medianSessionMinutes,
    // Always 0: Phase 1 doesn't verify geometry (see `verified: false` above).
    // Shown as-is rather than hidden, since it's an honest count of zero
    // verified sessions, not a fabricated one - flagged for you to reconsider
    // the label if 0% reads as a claim about your modeling rather than
    // "not measured yet."
    verifiedShare: 0,
  };

  // --- personal records ---------------------------------------------------
  const records: PersonalRecord[] = [];
  if (hasAnyData) {
    const longestSession = sessions.reduce((a, s) => (s.scoredMinutes > a.scoredMinutes ? s : a));
    const bestDay = daily.reduce((a, d) => (d.scoredMinutes > a.scoredMinutes ? d : a));
    let bestWeek = { start: "", minutes: 0 };
    for (let i = 0; i < daily.length; i++) {
      if (mondayIndexedDowFromDate(daily[i]!.date) !== 0) continue;
      const slice = daily.slice(i, i + 7);
      const minutes = slice.reduce((a, d) => a + d.scoredMinutes, 0);
      if (minutes > bestWeek.minutes) bestWeek = { start: slice[0]!.date, minutes };
    }
    const byMonth = new Map<string, number>();
    for (const d of daily) {
      if (d.sessions === 0) continue;
      const month = d.date.slice(0, 7);
      byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    }
    let bestMonth = { month: "", days: 0 };
    for (const [month, days] of byMonth) {
      if (days > bestMonth.days) bestMonth = { month, days };
    }
    records.push(
      { label: "Longest session", value: longestSession.scoredMinutes, unit: "min", when: longestSession.date },
      { label: "Best week", value: Math.round((bestWeek.minutes / 60) * 10) / 10, unit: "hrs", when: bestWeek.start },
      { label: "Most active days in a month", value: bestMonth.days, unit: "days", when: bestMonth.month ? `${bestMonth.month}-01` : "" },
      { label: "Biggest day", value: bestDay.scoredMinutes, unit: "min", when: bestDay.date }
    );
  }

  const afterMidnight = sessionRows.some((row) => isAfterMidnightWindow(row.started_at));
  let fullWeek = false;
  for (let i = 0; i + 7 <= daily.length; i++) {
    if (mondayIndexedDowFromDate(daily[i]!.date) !== 0) continue;
    const slice = daily.slice(i, i + 7);
    if (slice.every((d) => d.scoredMinutes >= QUALIFYING_MINUTES)) {
      fullWeek = true;
      break;
    }
  }
  const lifetimeHoursExact = lifetimeMinutes / 60;
  const BADGE_DEFS: { id: string; name: string; detail: string; glyph: string; earned: boolean }[] = [
    { id: "first", name: "First Extrude", detail: "Log your first session", glyph: "spark", earned: hasAnyData },
    { id: "hours10", name: "Ten Hours", detail: "10 hours modeled", glyph: "hourglass", earned: lifetimeHoursExact >= 10 },
    { id: "hours50", name: "Fifty Hours", detail: "50 hours modeled", glyph: "hourglass", earned: lifetimeHoursExact >= 50 },
    { id: "hours100", name: "Century", detail: "100 hours modeled", glyph: "crown", earned: lifetimeHoursExact >= 100 },
    { id: "streak7", name: "Week One", detail: "7-day streak", glyph: "flame", earned: longestStreak >= 7 },
    { id: "streak30", name: "Month Straight", detail: "30-day streak", glyph: "calendar", earned: longestStreak >= 30 },
    { id: "streak100", name: "Hundred Straight", detail: "100-day streak", glyph: "flame2", earned: longestStreak >= 100 },
    { id: "midnight", name: "After Midnight", detail: "A session after midnight", glyph: "sunrise", earned: afterMidnight },
    { id: "weekfull", name: "Full Week", detail: "Every day of one week", glyph: "check", earned: fullWeek },
  ];
  const badges: Badge[] = BADGE_DEFS.map((b) => ({ ...b, earnedOn: null }));

  return {
    hasAnyData,
    today,
    sessions,
    daily,
    week,
    todayStats,
    streak: {
      current: currentStreak,
      longest: longestStreak,
      weekMinutes,
      weekDaysElapsed: mondayOffset + 1,
      lastWeekMinutes,
      freezeBank,
      freezeUsedDates,
      lastFreezeUsed,
    },
    profile,
    records,
    badges,
  };
}
