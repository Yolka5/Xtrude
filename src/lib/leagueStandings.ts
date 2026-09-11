/**
 * Pure league ranking: weekly scored minutes in, ranked LeagueMember[] out.
 * Importable from scripts/verify-derive.ts — no Supabase, no cookies.
 */
import type { LeagueMember } from "@/lib/fixtures";
import { calendarDateInZone } from "../../scripts/lib/timezone.mjs";

const DAY_MS = 86_400_000;

export function addDaysIso(date: string, days: number): string {
  const ms = Date.parse(`${date}T12:00:00Z`) + days * DAY_MS;
  return calendarDateInZone(new Date(ms), "UTC");
}

export function weekWindow(todayMs: number): {
  today: string;
  weekStart: string;
  lastWeekStart: string;
  lastWeekEnd: string;
  daysElapsed: number;
} {
  const today = calendarDateInZone(todayMs);
  const mondayOffset = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = addDaysIso(today, -mondayOffset);
  const lastWeekStart = addDaysIso(weekStart, -7);
  return {
    today,
    weekStart,
    lastWeekStart,
    lastWeekEnd: addDaysIso(weekStart, -1),
    daysElapsed: mondayOffset + 1,
  };
}

export type SessionSlice = {
  started_at: string;
  scored_minutes: number;
};

export function minutesInDateRange(
  sessions: SessionSlice[],
  fromInclusive: string,
  toInclusive: string
): { minutes: number; sessions: number } {
  let minutes = 0;
  let count = 0;
  for (const s of sessions) {
    const date = calendarDateInZone(s.started_at);
    if (date >= fromInclusive && date <= toInclusive) {
      minutes += Number(s.scored_minutes) || 0;
      count += 1;
    }
  }
  return { minutes, sessions: count };
}

export type StandingInput = {
  userId: string;
  name: string;
  initials: string;
  weekMinutes: number;
  weekSessions: number;
  lastWeekMinutes: number;
};

export function rankStandings(inputs: StandingInput[], meId: string): LeagueMember[] {
  const byThisWeek = [...inputs].sort((a, b) => {
    if (b.weekMinutes !== a.weekMinutes) return b.weekMinutes - a.weekMinutes;
    return a.name.localeCompare(b.name);
  });
  const byLastWeek = [...inputs].sort((a, b) => {
    if (b.lastWeekMinutes !== a.lastWeekMinutes) return b.lastWeekMinutes - a.lastWeekMinutes;
    return a.name.localeCompare(b.name);
  });
  const lastRank = new Map(byLastWeek.map((m, i) => [m.userId, i + 1]));
  return byThisWeek.map((m, i) => {
    const rank = i + 1;
    const previous = lastRank.get(m.userId) ?? rank;
    return {
      id: m.userId,
      name: m.name,
      initials: m.initials,
      scoredMinutes: Math.round(m.weekMinutes),
      sessions: m.weekSessions,
      rank,
      lastRank: previous,
      movement: previous - rank,
      isMe: m.userId === meId,
    };
  });
}
