/**
 * Fixture generator for Phase 0.5.
 *
 * Run:  npm run fixtures
 * Emits: src/lib/fixtures.ts  (literal constants, committed to the repo)
 *
 * This is a build-time authoring tool, not app code. The app imports only the
 * emitted constants - nothing here ships to the browser and nothing here runs
 * at request time.
 *
 * The shape of the data is taken from what phase0_validate.py measured against
 * real Onshape microversion history, not invented:
 *
 *   - Onshape records granular edits. 73.5% of inter-event gaps fall under 30s,
 *     so a session is a dense burst of events, not a handful of checkpoints.
 *   - Sessions are short. Median ~12 minutes of credited time. People open CAD,
 *     fix one thing, and leave. Marathons are the exception.
 *   - Scoring mirrors the validated algorithm:
 *         rawMinutes    = last event - first event   (the observable span)
 *         scoredMinutes = min(raw + LEAD_IN, MAX)    (credit for the ramp-up
 *                                                     before the first save)
 *     with LEAD_IN = 5m, MAX = 4h, and clusters under MIN_EVENTS = 3 discarded
 *     as noise rather than counted as sessions.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- scoring constants, mirrored from phase0_validate.py --------------------
const IDLE_THRESHOLD_MINUTES = 20;
const LEAD_IN_MINUTES = 5;
const MAX_SESSION_HOURS = 4;
const MIN_EVENTS = 3;

// --- generation parameters --------------------------------------------------
const TODAY = "2026-09-09";       // the app's fixed "now"; nothing reads the clock
const HISTORY_DAYS = 182;         // 26 weeks, sized for the activity heatmap
const DETAILED_DAYS = 21;         // days for which full session objects are emitted
const CURRENT_STREAK = 12;
const SEED = 0x5f7ade;

// --- seeded PRNG so the committed output is reproducible ---------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

/** Skewed low: most sessions cluster near the short end, a few run long. */
function skewedSpan() {
  const u = rnd();
  const shaped = Math.pow(u, 1.9);          // bias toward 0
  return Math.round(1 + shaped * 19);       // 1..20 raw minutes
}

// --- dates (all UTC to keep the emitted strings stable) ----------------------
const DAY_MS = 86400000;
const todayMs = Date.parse(TODAY + "T00:00:00Z");
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const dow = (ms) => new Date(ms).getUTCDay();  // 0 Sun .. 6 Sat

// --- Onshape-ish document pool ----------------------------------------------
const DOCS = [
  { name: "Rover Chassis", tabs: ["Frame", "Skid Plate", "Suspension Mount"] },
  { name: "Drivetrain Gearbox", tabs: ["Housing", "Gear Train", "Output Shaft"] },
  { name: "Camera Mount Rev B", tabs: ["Bracket", "Ball Joint", "Assembly"] },
  { name: "M5 Standoff Kit", tabs: ["Standoff", "Drawing"] },
  { name: "Bearing Block", tabs: ["Block", "Cap", "Assembly"] },
  { name: "Enclosure v4", tabs: ["Shell", "Lid", "Gasket Groove"] },
];

// --- generate ---------------------------------------------------------------
/** @type {{date:string, sessions:any[]}[]} */
const days = [];
let seq = 0;

/* Document choice is streaky, not uniform. Engineering work has a focus: you
 * live in one part for several days, then move to the next one. Drawing each
 * session's document independently produced runs where a single document
 * happened to dominate a whole month by accident, which is both less realistic
 * and reads as a bug. This models the focus explicitly instead. */
let focus = pick(DOCS);
let focusDaysLeft = int(3, 8);
const FOCUS_SHARE = 0.62;

function chooseDoc() {
  if (rnd() < FOCUS_SHARE) return focus;
  return pick(DOCS.filter((d) => d.name !== focus.name));
}

for (let back = HISTORY_DAYS - 1; back >= 0; back--) {
  const ms = todayMs - back * DAY_MS;
  const date = iso(ms);
  const weekday = dow(ms);
  const weekend = weekday === 0 || weekday === 6;

  // Activity likelihood. The tail end of the range is the current streak, so
  // those days are always active. Earlier, a long streak is seeded by hand and
  // the rest is left patchy - which is what real usage looks like.
  const inCurrentStreak = back < CURRENT_STREAK;
  const inSeededStreak = back >= 96 && back <= 118;   // the 23-day best streak
  let pActive = weekend ? 0.42 : 0.68;
  if (back > 150) pActive = weekend ? 0.25 : 0.5;      // ramping up early on
  const active = inCurrentStreak || inSeededStreak || rnd() < pActive;

  if (!active) { days.push({ date, sessions: [] }); continue; }

  // A worked day advances the focus clock; the focus rotates when it expires.
  if (--focusDaysLeft <= 0) {
    focus = pick(DOCS.filter((d) => d.name !== focus.name));
    focusDaysLeft = int(3, 8);
  }

  // Several short bursts per day, not one block.
  const roll = rnd();
  let count = roll < 0.22 ? 1 : roll < 0.6 ? 2 : roll < 0.87 ? 3 : 4;
  if (weekend && rnd() < 0.45) count = Math.min(count, 2);

  // Lay the bursts out across the day, separated by more than the idle
  // threshold so they are genuinely distinct sessions under the algorithm.
  const sessions = [];
  let cursor = int(9, 12) * 60 + int(0, 55);          // first start, minutes past midnight
  for (let i = 0; i < count; i++) {
    const raw = skewedSpan();
    const scored = Math.min(raw + LEAD_IN_MINUTES, MAX_SESSION_HOURS * 60);

    // ~1 event per 40-70s of span, floored at MIN_EVENTS. This is the 73.5%
    // sub-30s-gap finding expressed as a density.
    const events = Math.max(MIN_EVENTS, Math.round((raw * 60) / int(40, 70)) + int(0, 3));

    // Geometry verification: most sessions move real geometry, some are pure
    // renames, drawing tweaks, or metadata edits and score nothing.
    const verified = rnd() < 0.82;

    const doc = chooseDoc();
    const documents = [{ name: doc.name, tab: pick(doc.tabs), edits: events }];
    if (rnd() < 0.22) {
      const other = pick(DOCS.filter((d) => d.name !== doc.name));
      const split = Math.max(1, Math.floor(events * 0.35));
      documents[0].edits = events - split;
      documents.push({ name: other.name, tab: pick(other.tabs), edits: split });
    }

    const startM = cursor;
    const endM = startM + raw;
    const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

    sessions.push({
      id: `s${String(++seq).padStart(4, "0")}`,
      date,
      start: hhmm(startM),
      end: hhmm(endM),
      rawMinutes: raw,
      scoredMinutes: scored,
      leadInMinutes: LEAD_IN_MINUTES,
      eventCount: events,
      verified,
      documents,
    });

    cursor = endM + int(IDLE_THRESHOLD_MINUTES + 12, 190);
    if (cursor > 22 * 60) break;
  }
  days.push({ date, sessions });
}

// --- aggregates -------------------------------------------------------------
const allSessions = days.flatMap((d) => d.sessions);
const daily = days.map((d) => ({
  date: d.date,
  scoredMinutes: d.sessions.reduce((a, s) => a + s.scoredMinutes, 0),
  sessions: d.sessions.length,
}));

const byDate = new Map(daily.map((d) => [d.date, d]));
const todayEntry = byDate.get(TODAY);

// current streak, counted backwards from today
let currentStreak = 0;
for (let back = 0; back < daily.length; back++) {
  const d = byDate.get(iso(todayMs - back * DAY_MS));
  if (d && d.sessions > 0) currentStreak++; else break;
}
// longest streak across the whole window
let longestStreak = 0, run = 0;
for (const d of daily) { run = d.sessions > 0 ? run + 1 : 0; longestStreak = Math.max(longestStreak, run); }

// this week, Monday-anchored
const todayDow = dow(todayMs);
const mondayOffset = (todayDow + 6) % 7;
const weekStartMs = todayMs - mondayOffset * DAY_MS;
const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const week = LABELS.map((label, i) => {
  const ms = weekStartMs + i * DAY_MS;
  const d = byDate.get(iso(ms)) || { date: iso(ms), scoredMinutes: 0, sessions: 0 };
  return {
    label, date: d.date,
    scoredMinutes: d.scoredMinutes,
    sessions: d.sessions,
    isToday: d.date === TODAY,
    isFuture: ms > todayMs,
  };
});

const lastWeek = LABELS.map((_, i) => {
  const d = byDate.get(iso(weekStartMs - 7 * DAY_MS + i * DAY_MS));
  return d ? d.scoredMinutes : 0;
});
const lastWeekMinutes = lastWeek.reduce((a, b) => a + b, 0);

const lifetimeMinutes = daily.reduce((a, d) => a + d.scoredMinutes, 0);
const activeDays = daily.filter((d) => d.sessions > 0).length;
const spans = allSessions.map((s) => s.scoredMinutes).sort((a, b) => a - b);
const medianSession = spans[Math.floor(spans.length / 2)];

// personal records
const longestSession = allSessions.reduce((a, s) => (s.scoredMinutes > a.scoredMinutes ? s : a));
const bestDay = daily.reduce((a, d) => (d.scoredMinutes > a.scoredMinutes ? d : a));
const busiestDay = daily.reduce((a, d) => (d.sessions > a.sessions ? d : a));
let bestWeek = { start: "", minutes: 0 };
for (let i = 0; i + 7 <= daily.length; i += 1) {
  const slice = daily.slice(i, i + 7);
  const m = slice.reduce((a, d) => a + d.scoredMinutes, 0);
  if (m > bestWeek.minutes) bestWeek = { start: slice[0].date, minutes: m };
}
const mostEvents = allSessions.reduce((a, s) => (s.eventCount > a.eventCount ? s : a));

// the detailed slice actually emitted as full session objects
const detailedCutoff = iso(todayMs - (DETAILED_DAYS - 1) * DAY_MS);
const detailed = allSessions.filter((s) => s.date >= detailedCutoff);
const recent = [...detailed].sort((a, b) =>
  (b.date + b.end).localeCompare(a.date + a.end));

// --- league -----------------------------------------------------------------
// Ranked by scored minutes this week. My row is derived from the generated
// history so the leaderboard can never contradict the Today screen; the other
// five are hand-set but scaled to the same world - a mid-week total for someone
// doing 2-3 twelve-minute bursts a day, not marathon hours.
const myWeekMinutes = week.reduce((a, d) => a + d.scoredMinutes, 0);
const myWeekSessions = week.reduce((a, d) => a + d.sessions, 0);

const leagueRoster = [
  { id: "m1", name: "Priya Raman",   initials: "PR", scoredMinutes: 118,           sessions: 9,              lastRank: 2, isMe: false },
  { id: "m2", name: "Tomas Weiss",   initials: "TW", scoredMinutes: 96,            sessions: 8,              lastRank: 1, isMe: false },
  { id: "m3", name: "You",           initials: "YS", scoredMinutes: myWeekMinutes, sessions: myWeekSessions, lastRank: 5, isMe: true  },
  { id: "m4", name: "Alex Nakamura", initials: "AN", scoredMinutes: 71,            sessions: 6,              lastRank: 3, isMe: false },
  { id: "m5", name: "Dani Okafor",   initials: "DO", scoredMinutes: 44,            sessions: 4,              lastRank: 4, isMe: false },
  { id: "m6", name: "Sam Ellery",    initials: "SE", scoredMinutes: 19,            sessions: 2,              lastRank: 6, isMe: false },
];

const league = {
  name: "Thursday Night CAD",
  memberCount: leagueRoster.length,
  daysElapsed: mondayOffset + 1,
  members: leagueRoster
    .sort((a, b) => b.scoredMinutes - a.scoredMinutes)
    .map((m, i) => ({ ...m, rank: i + 1, movement: m.lastRank - (i + 1) })),
};

// --- badges -----------------------------------------------------------------
const badges = [
  { id: "b1",  name: "First Extrude",  detail: "Log your first session",         glyph: "spark",     earned: true,  earnedOn: "2026-03-18" },
  { id: "b2",  name: "Week One",       detail: "7-day streak",                   glyph: "flame",     earned: true,  earnedOn: "2026-04-02" },
  { id: "b3",  name: "Fortnight",      detail: "14-day streak",                  glyph: "flame2",    earned: true,  earnedOn: "2026-06-11" },
  { id: "b4",  name: "Deep Work",      detail: "One session over 20 minutes",    glyph: "clock",     earned: true,  earnedOn: "2026-05-27" },
  { id: "b5",  name: "Verified 100",   detail: "100 geometry-verified sessions", glyph: "check",     earned: true,  earnedOn: "2026-07-30" },
  { id: "b6",  name: "Fifty Hours",    detail: "50 hours modeled",               glyph: "hourglass", earned: true,  earnedOn: "2026-08-21" },
  { id: "b7",  name: "Month Straight", detail: "30-day streak",                  glyph: "calendar",  earned: false, earnedOn: null },
  { id: "b8",  name: "Marathon",       detail: "One session over 2 hours",       glyph: "run",       earned: false, earnedOn: null },
  { id: "b9",  name: "League Winner",  detail: "Finish a week ranked first",     glyph: "trophy",    earned: false, earnedOn: null },
  { id: "b10", name: "Polymath",       detail: "Touch 10 documents in a week",   glyph: "layers",    earned: false, earnedOn: null },
  { id: "b11", name: "Dawn Patrol",    detail: "20 sessions before 8am",         glyph: "sunrise",   earned: false, earnedOn: null },
  { id: "b12", name: "Century",        detail: "100 hours modeled",              glyph: "crown",     earned: false, earnedOn: null },
];

// --- consistency ------------------------------------------------------------
/* Badges make factual claims about this data. Regenerating shifts every number,
 * so those claims are asserted rather than trusted - an earlier run shipped a
 * "100 hours modeled" badge marked earned against a 45-hour history. */
const verifiedCount = allSessions.filter((s) => s.verified).length;
const maxScored = Math.max(...allSessions.map((s) => s.scoredMinutes));
const lifetimeHours = lifetimeMinutes / 60;

const CLAIMS = {
  b1:  () => allSessions.length > 0,
  b2:  () => longestStreak >= 7,
  b3:  () => longestStreak >= 14,
  b4:  () => maxScored > 20,
  b5:  () => verifiedCount >= 100,
  b6:  () => lifetimeHours >= 50,
  b7:  () => longestStreak >= 30,
  b8:  () => maxScored > 120,
  b10: () => DOCS.length >= 10,
  b11: () => allSessions.filter((s) => Number(s.start.slice(0, 2)) < 8).length >= 20,
  b12: () => lifetimeHours >= 100,
};

const contradictions = badges
  .filter((b) => CLAIMS[b.id] && CLAIMS[b.id]() !== b.earned)
  .map((b) => `  ${b.id} "${b.name}" (${b.detail}) is marked ${b.earned ? "earned" : "locked"} but the data says otherwise`);

if (contradictions.length) {
  console.error("Badge claims contradict the generated data:");
  console.error(contradictions.join("\n"));
  console.error(`\n  lifetime ${lifetimeHours.toFixed(1)}h, longest streak ${longestStreak}d, ` +
    `longest session ${maxScored}m, verified ${verifiedCount}`);
  process.exit(1);
}

// --- emit -------------------------------------------------------------------
const j = (v) => JSON.stringify(v, null, 2);

const out = `/**
 * GENERATED FILE - do not edit by hand.
 * Regenerate with:  npm run fixtures   (see scripts/gen-fixtures.mjs)
 *
 * Phase 0.5 is a visual shell. Every number below is a constant. Nothing here
 * is fetched, computed at runtime, or derived from the system clock - the app's
 * "today" is the TODAY constant, so the UI renders identically forever.
 *
 * The distribution is modelled on what phase0_validate.py measured against real
 * Onshape microversion history: short bursts, several a day, median around
 * ${medianSession} minutes of credited time.
 */

/** The scoring parameters this data was generated under, mirrored from phase0_validate.py. */
export const SCORING = {
  idleThresholdMinutes: ${IDLE_THRESHOLD_MINUTES},
  leadInMinutes: ${LEAD_IN_MINUTES},
  maxSessionHours: ${MAX_SESSION_HOURS},
  minEvents: ${MIN_EVENTS},
} as const;

/** The app's fixed "now". Nothing reads Date.now(). */
export const TODAY = ${j(TODAY)};

export type TouchedDocument = {
  /** Onshape document name. */
  name: string;
  /** The tab (Part Studio / Assembly / Drawing) the edits landed in. */
  tab: string;
  /** Microversions attributed to this document within the session. */
  edits: number;
};

export type Session = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour. First recorded event. */
  start: string;
  /** HH:MM, 24-hour. Last recorded event. */
  end: string;
  /** Observed span: last event minus first event. */
  rawMinutes: number;
  /** Credited time: raw + lead-in, capped at the max session length. */
  scoredMinutes: number;
  /** Credit for ramp-up before the first save. */
  leadInMinutes: number;
  /** Microversions in the cluster. */
  eventCount: number;
  /** True when geometry actually changed, not just metadata. */
  verified: boolean;
  documents: TouchedDocument[];
};

export type DayTotal = { date: string; scoredMinutes: number; sessions: number };

export type WeekDay = {
  /** Short weekday name, Monday-anchored. */
  label: string;
  date: string;
  scoredMinutes: number;
  sessions: number;
  isToday: boolean;
  /** Later this week - rendered dimmed, not as a zero. */
  isFuture: boolean;
};

export type LeagueMember = {
  id: string;
  name: string;
  initials: string;
  scoredMinutes: number;
  sessions: number;
  /** Position at the end of last week, for the movement indicator. */
  lastRank: number;
  rank: number;
  /** lastRank - rank. Positive is a climb. */
  movement: number;
  isMe: boolean;
};

export type League = {
  name: string;
  memberCount: number;
  /** Days of the current week already counted, out of 7. */
  daysElapsed: number;
  members: LeagueMember[];
};

export type PersonalRecord = {
  label: string;
  value: number;
  unit: string;
  /** ISO date, or "" when the record is not tied to one day. */
  when: string;
};

export type TodayStats = { scoredMinutes: number; sessions: number; events: number };

export type StreakStats = {
  current: number;
  longest: number;
  /** Monday-to-today, this week. */
  weekMinutes: number;
  /** Days of this week counted so far, for like-for-like pace comparisons. */
  weekDaysElapsed: number;
  /** The equivalent full Monday-Sunday total for last week. */
  lastWeekMinutes: number;
};

export type ProfileStats = {
  name: string;
  handle: string;
  initials: string;
  memberSince: string;
  lifetimeMinutes: number;
  lifetimeHours: number;
  totalSessions: number;
  activeDays: number;
  longestStreak: number;
  currentStreak: number;
  medianSessionMinutes: number;
  /** Percentage of sessions where geometry actually changed. */
  verifiedShare: number;
};

export type Badge = {
  id: string;
  name: string;
  detail: string;
  glyph: string;
  earned: boolean;
  earnedOn: string | null;
};

/** Full session records for the last ${DETAILED_DAYS} days, newest first. */
export const SESSIONS: Session[] = ${j(recent)};

/** Daily totals across the whole ${HISTORY_DAYS}-day window, oldest first. Drives the activity chart. */
export const DAILY: DayTotal[] = ${j(daily)};

export const WEEK: WeekDay[] = ${j(week)};

export const TODAY_STATS: TodayStats = ${j({
  scoredMinutes: todayEntry.scoredMinutes,
  sessions: todayEntry.sessions,
  events: allSessions.filter((s) => s.date === TODAY).reduce((a, s) => a + s.eventCount, 0),
})};

export const STREAK: StreakStats = ${j({
  current: currentStreak,
  longest: longestStreak,
  weekMinutes: week.reduce((a, d) => a + d.scoredMinutes, 0),
  weekDaysElapsed: mondayOffset + 1,
  lastWeekMinutes,
})};

export const PROFILE: ProfileStats = ${j({
  name: "You",
  handle: "@yoni",
  initials: "YS",
  memberSince: "March 2026",
  lifetimeMinutes,
  lifetimeHours: Math.round((lifetimeMinutes / 60) * 10) / 10,
  totalSessions: allSessions.length,
  activeDays,
  longestStreak,
  currentStreak,
  medianSessionMinutes: medianSession,
  verifiedShare: Math.round((allSessions.filter((s) => s.verified).length / allSessions.length) * 100),
})};

export const RECORDS: PersonalRecord[] = ${j([
  { label: "Longest session", value: longestSession.scoredMinutes, unit: "min", when: longestSession.date },
  { label: "Best day", value: bestDay.scoredMinutes, unit: "min", when: bestDay.date },
  { label: "Best week", value: Math.round((bestWeek.minutes / 60) * 10) / 10, unit: "hrs", when: bestWeek.start },
  { label: "Most sessions in a day", value: busiestDay.sessions, unit: "", when: busiestDay.date },
  { label: "Most edits in a session", value: mostEvents.eventCount, unit: "", when: mostEvents.date },
  { label: "Longest streak", value: longestStreak, unit: "days", when: "" },
])};

export const LEAGUE: League = ${j(league)};

export const BADGES: Badge[] = ${j(badges)};
`;

writeFileSync(join(ROOT, "src/lib/fixtures.ts"), out);

console.log("wrote src/lib/fixtures.ts");
console.log(`  days generated     : ${HISTORY_DAYS}`);
console.log(`  sessions total     : ${allSessions.length}  (emitted in full: ${recent.length})`);
console.log(`  median scored      : ${medianSession} min`);
console.log(`  scored range       : ${spans[0]}-${spans[spans.length - 1]} min`);
console.log(`  sessions/active day: ${(allSessions.length / activeDays).toFixed(2)}`);
console.log(`  today              : ${todayEntry.scoredMinutes} min over ${todayEntry.sessions} sessions`);
console.log(`  current streak     : ${currentStreak}  longest: ${longestStreak}`);
console.log(`  lifetime           : ${(lifetimeMinutes / 60).toFixed(1)} h over ${activeDays} active days`);
console.log(`  badge claims       : all ${Object.keys(CLAIMS).length} checked against the data`);
