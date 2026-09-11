/**
 * Streak + freeze math. Shared by derive.ts (UI) and streakSnapshot.mjs
 * (midnight cron) so the two cannot disagree.
 *
 * A day counts toward a streak at >= QUALIFYING_MINUTES scored.
 * Each completed week that had at least one qualifying day earns 1 freeze
 * (banked, cap 2). A missed past day auto-spends a freeze to keep the
 * current streak; that spend is returned so the UI can say so.
 * An empty-so-far today does not break the streak and does not spend.
 */
import { calendarDateInZone } from "./timezone.mjs";

export const QUALIFYING_MINUTES = 10;
export const FREEZE_BANK_MAX = 2;

const DAY_MS = 86_400_000;

export function addDaysIso(date, days) {
  const ms = Date.parse(`${date}T12:00:00Z`) + days * DAY_MS;
  return calendarDateInZone(new Date(ms), "UTC");
}

export function mondayIndexedDowFromDate(isoDate) {
  return (new Date(`${isoDate}T12:00:00Z`).getUTCDay() + 6) % 7;
}

/**
 * @param {{ date: string, scoredMinutes: number }[]} daily dense, oldest first
 * @param {string} today YYYY-MM-DD
 */
export function computeStreakAndFreezes(daily, today) {
  let bank = 0;
  let current = 0;
  let longest = 0;
  /** @type {string[]} */
  const freezeUsedDates = [];
  let weekHadQualifying = false;

  for (const d of daily) {
    if (mondayIndexedDowFromDate(d.date) === 0) {
      if (weekHadQualifying) bank = Math.min(FREEZE_BANK_MAX, bank + 1);
      weekHadQualifying = false;
    }

    const qualifies = (d.scoredMinutes ?? 0) >= QUALIFYING_MINUTES;
    if (qualifies) weekHadQualifying = true;

    if (qualifies) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (d.date < today) {
      if (current > 0 && bank > 0) {
        bank -= 1;
        freezeUsedDates.push(d.date);
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
    }
  }

  return {
    current,
    longest,
    freezeBank: bank,
    freezeUsedDates,
    lastFreezeUsed: freezeUsedDates.length ? freezeUsedDates[freezeUsedDates.length - 1] : null,
  };
}
