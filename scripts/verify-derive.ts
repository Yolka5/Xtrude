/**
 * Regression check for the pure derivation logic in src/lib/db/derive.ts -
 * streak math, records, badge claims - against synthetic session/daily
 * rows. No live Supabase project needed, which is the point: this is the
 * one place worth automated coverage even before real credentials exist,
 * since it's arithmetic a human won't reliably eyeball-check on every edit.
 *
 * Run: npm run verify
 */
import { deriveRealData } from "../src/lib/db/derive";

const DAY = 86_400_000;
// Fix "today" to a known Wednesday: 2026-09-09 12:00 UTC (matches the app's
// prior fixed fixture TODAY, so this is easy to eyeball against known-good
// fixture numbers).
const TODAY_MS = Date.parse("2026-09-09T12:00:00Z");
const iso = (offsetDays: number) => new Date(TODAY_MS + offsetDays * DAY).toISOString().slice(0, 10);

const docNameById = new Map([
  ["doc1", "Bearing Block"],
  ["doc2", "Rover Chassis"],
]);

// Sessions: an 18-day active streak ending YESTERDAY (today has nothing yet
// - should NOT zero the streak, per the deliberate deviation), plus one
// earlier isolated day for a "best day"/"longest session" record, plus a gap.
const sessionRows: Parameters<typeof deriveRealData>[0] = [];
let id = 1;
function addSession(dayOffset: number, minutes: number, events: number, docs: string[]) {
  const start = new Date(TODAY_MS + dayOffset * DAY);
  start.setUTCHours(14, 0, 0, 0);
  const end = new Date(start.getTime() + (minutes - 5) * 60_000);
  sessionRows.push({
    id: `s${id++}`,
    started_at: start.toISOString(),
    ended_at: end.toISOString(),
    raw_minutes: minutes - 5,
    scored_minutes: minutes,
    event_count: events,
    document_ids: docs,
  });
}

// 18-day streak: today-18 .. today-1 (today itself untouched so far)
for (let back = 18; back >= 1; back--) {
  addSession(-back, 12, 5, ["doc1"]);
}
// An outlier far in the past: longest session + most events + best day
addSession(-40, 90, 40, ["doc1", "doc2"]);
// A day with 3 sessions (busiest day)
addSession(-25, 10, 4, ["doc1"]);
addSession(-25, 8, 3, ["doc2"]);
addSession(-25, 6, 3, ["doc1"]);

const dailyRows: Parameters<typeof deriveRealData>[1] = [];
{
  const byDate = new Map<string, { total_scored_minutes: number; session_count: number }>();
  for (const s of sessionRows) {
    const date = s.started_at.slice(0, 10);
    const e = byDate.get(date) ?? { total_scored_minutes: 0, session_count: 0 };
    e.total_scored_minutes += s.scored_minutes;
    e.session_count += 1;
    byDate.set(date, e);
  }
  for (const [date, v] of byDate) dailyRows.push({ date, ...v });
  dailyRows.sort((a, b) => a.date.localeCompare(b.date));
}

const result = deriveRealData(sessionRows, dailyRows, docNameById, TODAY_MS);

let failures = 0;
function check(label: string, cond: boolean, detail: string) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}  ${cond ? "" : "- " + detail}`);
  if (!cond) failures++;
}

check("hasAnyData", result.hasAnyData === true, `got ${result.hasAnyData}`);
check("today is fixed date", result.today === iso(0), `got ${result.today}, expected ${iso(0)}`);
check(
  "current streak = 18 despite empty today (deliberate deviation)",
  result.streak.current === 18,
  `got ${result.streak.current}`
);
check("longest streak = 18", result.streak.longest === 18, `got ${result.streak.longest}`);
check(
  "today stats are all zero (no session logged yet today)",
  result.todayStats.scoredMinutes === 0 && result.todayStats.sessions === 0,
  `got ${JSON.stringify(result.todayStats)}`
);
check("total sessions = 22", result.sessions.length === 22, `got ${result.sessions.length}`);
check(
  "longest session record = 90 min",
  result.records.find((r) => r.label === "Longest session")?.value === 90,
  JSON.stringify(result.records.find((r) => r.label === "Longest session"))
);
check(
  "most sessions in a day = 3",
  result.records.find((r) => r.label === "Most sessions in a day")?.value === 3,
  JSON.stringify(result.records.find((r) => r.label === "Most sessions in a day"))
);
check(
  "most edits in a session = 40",
  result.records.find((r) => r.label === "Most edits in a session")?.value === 40,
  ""
);
check(
  "badge b2 (7-day streak) earned",
  result.badges.find((b) => b.id === "b2")?.earned === true,
  ""
);
check(
  "badge b3 (14-day streak) earned",
  result.badges.find((b) => b.id === "b3")?.earned === true,
  ""
);
check(
  "badge b7 (30-day streak) NOT earned",
  result.badges.find((b) => b.id === "b7")?.earned === false,
  ""
);
check(
  "no b5/b9/b11 in badge list (hidden, not locked)",
  !result.badges.some((b) => ["b5", "b9", "b11"].includes(b.id)),
  JSON.stringify(result.badges.map((b) => b.id))
);
check(
  "documents resolve to real names",
  result.sessions.every((s) => s.documents.every((d) => d.name !== "Unknown document")),
  JSON.stringify(result.sessions.find((s) => s.documents.some((d) => d.name === "Unknown document")))
);
check("daily is dense (no gaps)", (() => {
  for (let i = 1; i < result.daily.length; i++) {
    const prev = Date.parse(result.daily[i - 1].date + "T00:00:00Z");
    const cur = Date.parse(result.daily[i].date + "T00:00:00Z");
    if (cur - prev !== DAY) return false;
  }
  return true;
})(), "gap found in daily series");

console.log("\nweek:", JSON.stringify(result.week.map((d) => `${d.label}:${d.scoredMinutes}${d.isFuture ? "(future)" : ""}${d.isToday ? "(today)" : ""}`)));
console.log("profile:", JSON.stringify(result.profile, null, 2));

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks pass.");
process.exit(failures ? 1 : 0);
