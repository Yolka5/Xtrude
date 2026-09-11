/**
 * Pure push-trigger decisions. Importable from scripts/verify-derive.ts.
 * Sending and app_state I/O live in reminders.ts.
 */
import { calendarDateInZone, zonedParts } from "../../../scripts/lib/timezone.mjs";

export const STREAK_RISK_HOUR = 20;

export function isPastStreakRiskHour(now: Date | number | string): boolean {
  const hour = Number(zonedParts(now).hour);
  return Number.isFinite(hour) && hour >= STREAK_RISK_HOUR;
}

export function streakAtRiskShouldFire(opts: {
  now: Date | number | string;
  currentStreak: number;
  todaySessionCount: number;
  alreadySentToday: boolean;
}): boolean {
  if (opts.alreadySentToday) return false;
  if (opts.currentStreak <= 0) return false;
  if (opts.todaySessionCount > 0) return false;
  if (!isPastStreakRiskHour(opts.now)) return false;
  return true;
}

export type LeagueMemberMinutes = {
  userId: string;
  weekMinutes: number;
  name?: string;
};

export type LeagueOvertake = {
  passerId: string;
  passerName: string;
  passerMinutes: number;
  myMinutes: number;
};

/** Someone who was behind or tied with you now has a strictly higher weekly total. */
export function leagueOvertakes(
  meId: string,
  previous: LeagueMemberMinutes[],
  current: LeagueMemberMinutes[]
): LeagueOvertake[] {
  const prevMe = previous.find((m) => m.userId === meId);
  const currMe = current.find((m) => m.userId === meId);
  if (!prevMe || !currMe) return [];
  const prevBy = new Map(previous.map((m) => [m.userId, m]));
  const out: LeagueOvertake[] = [];
  for (const other of current) {
    if (other.userId === meId) continue;
    const prevOther = prevBy.get(other.userId);
    if (!prevOther) continue;
    if (prevOther.weekMinutes <= prevMe.weekMinutes && other.weekMinutes > currMe.weekMinutes) {
      out.push({
        passerId: other.userId,
        passerName: other.name || "Someone",
        passerMinutes: other.weekMinutes,
        myMinutes: currMe.weekMinutes,
      });
    }
  }
  return out;
}

export function newlyEarnedBadges(
  previousEarnedIds: string[],
  current: { id: string; name: string; earned: boolean }[]
): { id: string; name: string }[] {
  const prev = new Set(previousEarnedIds);
  return current.filter((b) => b.earned && !prev.has(b.id)).map((b) => ({ id: b.id, name: b.name }));
}

/** First snapshot stores the baseline and must not notify for history. */
export function badgeAwardsToNotify(
  previousEarnedIds: string[] | null,
  current: { id: string; name: string; earned: boolean }[]
): { id: string; name: string }[] {
  if (previousEarnedIds == null) return [];
  return newlyEarnedBadges(previousEarnedIds, current);
}

export function pushDedupeKey(userId: string, kind: "streak" | "league" | "badge", day: string, extra?: string): string {
  return extra ? `push_dedupe_${userId}_${kind}_${extra}_${day}` : `push_dedupe_${userId}_${kind}_${day}`;
}

export function pushSnapKey(userId: string, kind: "league" | "badges", extra?: string): string {
  return extra ? `push_snap_${userId}_${kind}_${extra}` : `push_snap_${userId}_${kind}`;
}

export function civilDay(now: Date | number | string): string {
  return calendarDateInZone(now);
}
