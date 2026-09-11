/**
 * Single source of truth for "what calendar day is this instant?"
 *
 * Timestamps stay UTC in the database. Grouping, streaks, Today/Yesterday,
 * and clock labels convert at the edge with Asia/Jerusalem so a 1am local
 * session is not credited to yesterday and 23:30 does not spill into tomorrow.
 */
export const APP_TIMEZONE = "Asia/Jerusalem";

/**
 * @param {string | number | Date} instant
 * @param {string} [timeZone]
 */
export function zonedParts(instant, timeZone = APP_TIMEZONE) {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`zonedParts: invalid instant ${String(instant)}`);
  }
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
  };
}

/**
 * Civil YYYY-MM-DD in `timeZone`. This is the day-boundary used for
 * daily_stats, streaks, and Today — not the UTC date of the timestamptz.
 *
 * @param {string | number | Date} instant
 * @param {string} [timeZone]
 */
export function calendarDateInZone(instant, timeZone = APP_TIMEZONE) {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * 24-hour `HH:MM` in `timeZone`, for Session.start / Session.end.
 *
 * @param {string | number | Date} instant
 * @param {string} [timeZone]
 */
export function clockHmInZone(instant, timeZone = APP_TIMEZONE) {
  const p = zonedParts(instant, timeZone);
  return `${p.hour}:${p.minute}`;
}
