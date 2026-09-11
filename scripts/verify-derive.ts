/**
 * Regression check for the pure derivation logic in src/lib/db/derive.ts -
 * streak math, records, badge claims - and for the noise filter in
 * scripts/lib/sessionAlgorithm.mjs, against synthetic session/daily/event
 * rows. No live Supabase project needed, which is the point: this is the
 * one place worth automated coverage even before real credentials exist,
 * since it's arithmetic a human won't reliably eyeball-check on every edit.
 *
 * Run: npm run verify
 */
import { deriveRealData } from "../src/lib/db/derive";
import { clusterSessions, MIN_EVENTS, MIN_SPAN_MINUTES } from "./lib/sessionAlgorithm.mjs";
import { calendarDateInZone, clockHmInZone } from "./lib/timezone.mjs";
import { rankStandings } from "../src/lib/leagueStandings";
import { decryptSecret, encryptSecret } from "../src/lib/auth/tokenCrypto";
import { createSessionToken, readSessionUserId } from "../src/lib/auth/session";

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

// --- clusterSessions / noise filter -----------------------------------
// Two-part rule: a cluster is kept only if it has >= MIN_EVENTS AND spans
// >= MIN_SPAN_MINUTES from first to last event. Event count alone used to
// be the whole rule; these cases are the ones that rule got wrong.
console.log(`\nnoise filter: MIN_EVENTS=${MIN_EVENTS} MIN_SPAN_MINUTES=${MIN_SPAN_MINUTES}`);

const CLUSTER_BASE_MS = Date.parse("2026-09-01T09:00:00Z");
function mkEvents(offsetsSeconds: number[], docId = "doc1") {
  return offsetsSeconds.map((s) => ({
    occurred_at: new Date(CLUSTER_BASE_MS + s * 1000).toISOString(),
    document_id: docId,
  }));
}

const clusterCases: { label: string; offsets: number[]; expectKept: boolean }[] = [
  {
    label: "5 events spanning 4s (enough events, too short a span) -> dropped",
    offsets: [0, 1, 2, 3, 4],
    expectKept: false,
  },
  {
    label: "3-second autosave tick (2 events) -> dropped",
    offsets: [0, 3],
    expectKept: false,
  },
  {
    label: "35-second autosave cluster (4 events) -> dropped",
    offsets: [0, 10, 20, 35],
    expectKept: false,
  },
  {
    label: "single event (0s span) -> dropped",
    offsets: [0],
    expectKept: false,
  },
  {
    label: "span exactly at the 2-minute floor (2 events, 120s) -> kept",
    offsets: [0, 120],
    expectKept: true,
  },
  {
    label: "real short session, 4m38s (3 events) -> kept",
    offsets: [0, 140, 278],
    expectKept: true,
  },
  {
    label: "real short session, 10m39s (3 events) -> kept",
    offsets: [0, 300, 639],
    expectKept: true,
  },
  {
    label: "real short session, 15m8s (3 events) -> kept",
    offsets: [0, 500, 908],
    expectKept: true,
  },
];

for (const c of clusterCases) {
  const [cluster] = clusterSessions(mkEvents(c.offsets));
  check(
    `clusterSessions: ${c.label}`,
    cluster.kept === c.expectKept,
    `got kept=${cluster.kept} (events=${cluster.eventCount}, spanSeconds=${cluster.spanSeconds})`
  );
}

// Asia/Jerusalem day boundary (DST, UTC+3 on 12 Sep 2026).
// 00:30 local = 21:30 UTC previous calendar day; 23:30 local = 20:30 UTC same UTC day.
const israelMidnight = "2026-09-11T21:30:00.000Z"; // 00:30 IDT on 12 Sep
const israelLate = "2026-09-12T20:30:00.000Z"; // 23:30 IDT on 12 Sep
check(
  "00:30 Israel lands on that local calendar day, not UTC yesterday",
  calendarDateInZone(israelMidnight) === "2026-09-12" && clockHmInZone(israelMidnight) === "00:30",
  `date=${calendarDateInZone(israelMidnight)} time=${clockHmInZone(israelMidnight)}`
);
check(
  "23:30 Israel does not roll into tomorrow",
  calendarDateInZone(israelLate) === "2026-09-12" && clockHmInZone(israelLate) === "23:30",
  `date=${calendarDateInZone(israelLate)} time=${clockHmInZone(israelLate)}`
);

const edgeRows: Parameters<typeof deriveRealData>[0] = [
  {
    id: "early",
    started_at: israelMidnight,
    ended_at: "2026-09-11T21:50:00.000Z",
    raw_minutes: 20,
    scored_minutes: 25,
    event_count: 4,
    document_ids: ["doc1"],
  },
  {
    id: "late",
    started_at: israelLate,
    ended_at: "2026-09-12T20:50:00.000Z",
    raw_minutes: 20,
    scored_minutes: 25,
    event_count: 4,
    document_ids: ["doc1"],
  },
];
const edgeDaily = [
  { date: "2026-09-12", total_scored_minutes: 50, session_count: 2 },
];
const edge = deriveRealData(edgeRows, edgeDaily, docNameById, Date.parse("2026-09-12T07:00:00.000Z"));
check("derive: 00:30 Israel session.date is 2026-09-12", edge.sessions.find((s) => s.id === "early")?.date === "2026-09-12", JSON.stringify(edge.sessions.find((s) => s.id === "early")));
check("derive: 00:30 Israel clock is 12:30 AM", edge.sessions.find((s) => s.id === "early")?.start === "00:30", "");
check("derive: 23:30 Israel session.date stays 2026-09-12", edge.sessions.find((s) => s.id === "late")?.date === "2026-09-12", JSON.stringify(edge.sessions.find((s) => s.id === "late")));
check("derive: 23:30 Israel clock is 11:30 PM", edge.sessions.find((s) => s.id === "late")?.start === "23:30", "");
check("derive: today in Jerusalem at 10:00 IDT is 2026-09-12", edge.today === "2026-09-12", `got ${edge.today}`);

const ranked = rankStandings(
  [
    { userId: "a", name: "Ada", initials: "A", weekMinutes: 40, weekSessions: 2, lastWeekMinutes: 10 },
    { userId: "me", name: "Yoni", initials: "YS", weekMinutes: 11, weekSessions: 1, lastWeekMinutes: 80 },
  ],
  "me"
);
check("league: leader is Ada", ranked[0].id === "a" && ranked[0].rank === 1, JSON.stringify(ranked[0]));
check("league: me is rank 2 from last week's 1 (movement -1)", ranked[1].rank === 2 && ranked[1].lastRank === 1 && ranked[1].movement === -1 && ranked[1].isMe, JSON.stringify(ranked[1]));
check("league: scored minutes are real inputs, not fixtures", ranked[1].scoredMinutes === 11 && ranked[1].sessions === 1, JSON.stringify(ranked[1]));

const solo = rankStandings(
  [{ userId: "me", name: "Yoni", initials: "YS", weekMinutes: 47, weekSessions: 2, lastWeekMinutes: 47 }],
  "me"
);
check("league: a league of one ranks first, isMe, holding", solo.length === 1 && solo[0].rank === 1 && solo[0].isMe && solo[0].movement === 0 && solo[0].scoredMinutes === 47, JSON.stringify(solo[0]));

{
  const secret = "x".repeat(32);
  const cipher = encryptSecret("onshape-access-token", secret);
  check("oauth token encrypt roundtrip", decryptSecret(cipher, secret) === "onshape-access-token", "");
  let threw = false;
  try {
    decryptSecret(cipher, "y".repeat(32));
  } catch {
    threw = true;
  }
  check("oauth token encrypt rejects the wrong key", threw, "");
}

void (async () => {
  const secret = "x".repeat(32);
  const uid = "e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70";
  const tok = await createSessionToken(uid, secret);
  check("session cookie roundtrip", (await readSessionUserId(tok, secret)) === uid, "");
  check("session cookie rejects a missing secret", (await readSessionUserId(tok, undefined)) === null, "");
  const tampered = tok.slice(0, -3) + "aaa";
  check("session cookie rejects tampering", (await readSessionUserId(tampered, secret)) === null, "");

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks pass.");
  process.exit(failures ? 1 : 0);
})();

