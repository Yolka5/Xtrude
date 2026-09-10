/**
 * Phase 0.5 anchored all date maths to a frozen TODAY fixture constant,
 * because the shell was statically exported and a clock-dependent render
 * would drift out of sync with the prerendered HTML the moment the day
 * rolled over. Phase 1 has a real server rendering these on every request
 * (see the `force-dynamic` pages), so "today" is the real clock now - the
 * original problem this was working around no longer exists. `todayMs()`
 * reads the clock fresh on every call rather than once at module load,
 * since a long-running server process could otherwise freeze "today" at
 * whatever moment it happened to first import this module.
 */

const DAY_MS = 86400000;
const ms = (isoDate: string) => Date.parse(`${isoDate}T00:00:00Z`);
function todayMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function daysAgo(isoDate: string): number {
  return Math.round((todayMs() - ms(isoDate)) / DAY_MS);
}

/** "Today" / "Yesterday" / "Mon 7 Sep" */
export function dayLabel(isoDate: string): string {
  const d = daysAgo(isoDate);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  const t = new Date(ms(isoDate));
  return `${WEEKDAY[t.getUTCDay()]} ${t.getUTCDate()} ${MONTH[t.getUTCMonth()]}`;
}

/** "9 September 2026" */
export function longDate(isoDate: string): string {
  const t = new Date(ms(isoDate));
  const full = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  return `${t.getUTCDate()} ${full[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}

/** "7 Sep" */
export function shortDate(isoDate: string): string {
  const t = new Date(ms(isoDate));
  return `${t.getUTCDate()} ${MONTH[t.getUTCMonth()]}`;
}

export function monthLabel(isoDate: string): string {
  return MONTH[new Date(ms(isoDate)).getUTCMonth()];
}

/** Big stat rendering: value and unit kept apart so they can be styled apart. */
export function splitDuration(minutes: number): { value: string; unit: string } {
  if (minutes < 60) return { value: String(minutes), unit: "min" };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return { value: String(h), unit: h === 1 ? "hr" : "hrs" };
  return { value: `${h}:${String(m).padStart(2, "0")}`, unit: "hrs" };
}

/** Inline rendering: "27m", "1h 22m". */
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Spoken form for screen readers - "1 hour 22 minutes" beats "1h 22m". */
export function durationSpoken(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m || !h) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/** "09:14" -> "9:14 AM" */
export function clockTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
