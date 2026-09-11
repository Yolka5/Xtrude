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
import { calendarDateInZone, clockHmInZone, isAfterMidnightWindow } from "./lib/timezone.mjs";
import { rankStandings, generateJoinCode, JOIN_CODE_ALPHABET, JOIN_CODE_LENGTH, joinCodeIsUnambiguous, allocateJoinCode, renameLeagueState, regenerateLeagueCode } from "../src/lib/leagueStandings";
import { decryptSecret, encryptSecret } from "../src/lib/auth/tokenCrypto";
import { createSessionToken, readSessionUserId, authenticatedUserId, SESSION_COOKIE } from "../src/lib/auth/session";
import { proxy, isPublicPath } from "../src/proxy";
import { NextRequest } from "next/server";
import { discoveryDue, whoIsDue } from "../src/lib/discoverySchedule";
import { applyOnshapeLogin, canRebindOnshapeId, sessionsFor, type UserDataStore } from "../src/lib/auth/bindUser";
import { clientPushConfig, pushIsConfigured } from "../src/lib/push/config";
import {
  badgeAwardsToNotify,
  isPastStreakRiskHour,
  leagueOvertakes,
  pushDedupeKey,
  streakAtRiskShouldFire,
} from "../src/lib/push/triggers";
import { connectPathWithInvite, inviteCodeFromNext, invitePath, oauthStartPath, planJoinLanding, safeNextPath } from "../src/lib/invite";
import { firstRunCopy } from "../src/lib/firstRun";
import { withOAuthAccess } from "../src/lib/auth/oauthAccess";
import { DEFAULT_MAX_CALLS_PER_RUN, simulateCappedRun } from "./lib/callBudget.mjs";
import { assembleSessionDocuments, countDocumentsFromEvents, sessionQualification } from "../src/lib/sessionDetail";
import { memberSinceLabel, profileImageUrlFromSession, sanitizeDisplayName } from "../src/lib/profileFields";

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
  "biggest day record = 90 min",
  result.records.find((r) => r.label === "Biggest day")?.value === 90,
  JSON.stringify(result.records.find((r) => r.label === "Biggest day"))
);
check(
  "badge first session earned",
  result.badges.find((b) => b.id === "first")?.earned === true,
  ""
);
check(
  "badge 7-day streak earned",
  result.badges.find((b) => b.id === "streak7")?.earned === true,
  ""
);
check(
  "badge 30-day streak NOT earned",
  result.badges.find((b) => b.id === "streak30")?.earned === false,
  ""
);
check(
  "badge 10h NOT earned at 5.5h lifetime",
  result.badges.find((b) => b.id === "hours10")?.earned === false,
  JSON.stringify(result.profile.lifetimeHours)
);
check(
  "badge after-midnight NOT earned on afternoon sessions",
  result.badges.find((b) => b.id === "midnight")?.earned === false,
  ""
);
check(
  "badge full week earned from the 18-day run",
  result.badges.find((b) => b.id === "weekfull")?.earned === true,
  ""
);

const empty = deriveRealData([], [], new Map(), TODAY_MS);
check(
  "no badge is earned without data",
  empty.badges.length > 0 && empty.badges.every((b) => b.earned === false),
  JSON.stringify(empty.badges.filter((b) => b.earned).map((b) => b.id))
);
check("no records without data", empty.records.length === 0, JSON.stringify(empty.records));
check(
  "no streak without data",
  empty.streak.current === 0 && empty.streak.longest === 0,
  JSON.stringify(empty.streak)
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
check(
  "badge after-midnight earned from a 00:30 session",
  edge.badges.find((b) => b.id === "midnight")?.earned === true,
  JSON.stringify(edge.badges.find((b) => b.id === "midnight"))
);

function midnightSession(id: string, startedAt: string): Parameters<typeof deriveRealData>[0][number] {
  return {
    id,
    started_at: startedAt,
    ended_at: new Date(Date.parse(startedAt) + 20 * 60_000).toISOString(),
    raw_minutes: 20,
    scored_minutes: 25,
    event_count: 4,
    document_ids: ["doc1"],
  };
}
function midnightBadge(startedAt: string, todayMs: number) {
  return deriveRealData(
    [midnightSession("m", startedAt)],
    [{ date: calendarDateInZone(startedAt), total_scored_minutes: 25, session_count: 1 }],
    docNameById,
    todayMs
  ).badges.find((b) => b.id === "midnight")?.earned;
}

{
  const idtToday = Date.parse("2026-09-12T07:00:00.000Z");
  const istToday = Date.parse("2026-01-15T10:00:00.000Z");
  check("04:59 IDT counts for After Midnight", midnightBadge("2026-09-12T01:59:00.000Z", idtToday) === true, "");
  check("05:00 IDT does not count for After Midnight", midnightBadge("2026-09-12T02:00:00.000Z", idtToday) === false, "");
  check("04:59 IST (winter) counts for After Midnight", midnightBadge("2026-01-15T02:59:00.000Z", istToday) === true, "");
  check("05:00 IST (winter) does not count for After Midnight", midnightBadge("2026-01-15T03:00:00.000Z", istToday) === false, "");
  check("UTC 02:30 in September is 05:30 IDT and does not count", midnightBadge("2026-09-12T02:30:00.000Z", idtToday) === false, `window=${isAfterMidnightWindow("2026-09-12T02:30:00.000Z")} clock=${clockHmInZone("2026-09-12T02:30:00.000Z")}`);
  check("04:59 IDT is 01:59 UTC not 04:59 UTC", clockHmInZone("2026-09-12T01:59:00.000Z") === "04:59" && isAfterMidnightWindow("2026-09-12T01:59:00.000Z") === true, clockHmInZone("2026-09-12T01:59:00.000Z"));
  check("04:59 IST is 02:59 UTC not 04:59 UTC", clockHmInZone("2026-01-15T02:59:00.000Z") === "04:59" && isAfterMidnightWindow("2026-01-15T02:59:00.000Z") === true, clockHmInZone("2026-01-15T02:59:00.000Z"));
}

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
check(
  "league join code is 6 unambiguous chars",
  generateJoinCode(new Uint8Array([0, 1, 2, 3, 4, 5])).length === 6,
  generateJoinCode(new Uint8Array([0, 1, 2, 3, 4, 5]))
);
check(
  "join code alphabet has no 0/O/1/I/L",
  ![...JOIN_CODE_ALPHABET].some((ch) => "01IOL".includes(ch)),
  JOIN_CODE_ALPHABET
);
{
  const taken = new Set<string>();
  let n = 0;
  const nextBytes = () => {
    const b = new Uint8Array(JOIN_CODE_LENGTH);
    let x = n++;
    for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
      b[i] = x % JOIN_CODE_ALPHABET.length;
      x = Math.floor(x / JOIN_CODE_ALPHABET.length);
    }
    return b;
  };
  for (let i = 0; i < 80; i++) {
    taken.add(allocateJoinCode(taken, nextBytes));
  }
  check("allocateJoinCode yields 80 unique codes", taken.size === 80, String(taken.size));
  check("generated join codes exclude 0O1IL", [...taken].every(joinCodeIsUnambiguous), [...taken].find((c) => !joinCodeIsUnambiguous(c)) ?? "");
  const blocked = new Set(taken);
  const first = [...taken][0]!;
  const firstBytes = new Uint8Array([...first].map((ch) => JOIN_CODE_ALPHABET.indexOf(ch)));
  let collisions = 0;
  const collidingThenNew = () => {
    collisions += 1;
    if (collisions < 3) return firstBytes;
    return nextBytes();
  };
  const allocated = allocateJoinCode(blocked, collidingThenNew);
  check(
    "allocateJoinCode skips codes already taken",
    allocated !== first && !blocked.has(allocated) && joinCodeIsUnambiguous(allocated),
    allocated
  );
}

{
  const league = { name: "Studio", joinCode: "ABC234", memberIds: ["a", "b"] };
  const renamed = renameLeagueState(league, "Thursday night");
  check("rename keeps the join code", renamed.joinCode === "ABC234" && renamed.name === "Thursday night", JSON.stringify(renamed));
  check("rename keeps membership", renamed.memberIds.join(",") === "a,b", JSON.stringify(renamed.memberIds));
  const regen = regenerateLeagueCode(renamed, "XYZ789");
  check("regenerating the code does not rename", regen.name === "Thursday night" && regen.joinCode === "XYZ789", JSON.stringify(regen));
  check("regenerating the code keeps membership", regen.memberIds.join(",") === "a,b", JSON.stringify(regen.memberIds));
}

{
  const nineMin: Parameters<typeof deriveRealData>[0] = [{
    id: "short",
    started_at: "2026-09-08T12:00:00Z",
    ended_at: "2026-09-08T12:09:00Z",
    raw_minutes: 9,
    scored_minutes: 9,
    event_count: 3,
    document_ids: ["doc1"],
  }];
  const nine = deriveRealData(nineMin, [{ date: "2026-09-08", total_scored_minutes: 9, session_count: 1 }], docNameById, TODAY_MS);
  check("9 scored minutes is not a streak day", nine.streak.current === 0 && nine.streak.longest === 0, JSON.stringify(nine.streak));
}

{
  const freezeRows: Parameters<typeof deriveRealData>[0] = [];
  let fid = 1;
  function freezeSession(dayOffset: number, minutes: number) {
    const start = new Date(TODAY_MS + dayOffset * DAY);
    start.setUTCHours(14, 0, 0, 0);
    const end = new Date(start.getTime() + minutes * 60_000);
    freezeRows.push({
      id: `f${fid++}`,
      started_at: start.toISOString(),
      ended_at: end.toISOString(),
      raw_minutes: minutes,
      scored_minutes: minutes,
      event_count: 4,
      document_ids: ["doc1"],
    });
  }
  for (let back = 9; back >= 3; back--) freezeSession(-back, 12);
  freezeSession(-1, 12);
  const freezeDaily: Parameters<typeof deriveRealData>[1] = [];
  {
    const byDate = new Map<string, { total_scored_minutes: number; session_count: number }>();
    for (const s of freezeRows) {
      const date = s.started_at.slice(0, 10);
      const e = byDate.get(date) ?? { total_scored_minutes: 0, session_count: 0 };
      e.total_scored_minutes += s.scored_minutes;
      e.session_count += 1;
      byDate.set(date, e);
    }
    for (const [date, v] of byDate) freezeDaily.push({ date, ...v });
  }
  const frozen = deriveRealData(freezeRows, freezeDaily, docNameById, TODAY_MS);
  check(
    "freeze saves a missed day instead of silently dropping the streak",
    frozen.streak.current === 9 && frozen.streak.lastFreezeUsed === "2026-09-07",
    JSON.stringify(frozen.streak)
  );
  check(
    "a used freeze is reported, never hidden",
    frozen.streak.freezeUsedDates.includes("2026-09-07"),
    JSON.stringify(frozen.streak.freezeUsedDates)
  );
}

{
  // Cron day: Friday 11 Sep 2026, noon Israel (09:00 UTC). Discovery is
  // decided from sessions + last-discovery stamps — no Onshape calls.
  const cronNow = Date.parse("2026-09-11T09:00:00.000Z");
  const synthetic = [
    {
      id: "active-yesterday",
      lastSessionAt: "2026-09-10T16:00:00.000Z",
      lastDiscoveredAt: "2026-09-10T18:00:00.000Z",
    },
    {
      id: "quiet-10d",
      lastSessionAt: "2026-09-01T16:00:00.000Z",
      lastDiscoveredAt: "2026-09-08T22:05:00.000Z",
    },
    {
      id: "brand-new",
      lastSessionAt: null,
      lastDiscoveredAt: "2026-09-11T08:00:00.000Z",
    },
    {
      id: "dormant-months",
      lastSessionAt: "2026-03-01T16:00:00.000Z",
      lastDiscoveredAt: "2026-07-01T22:05:00.000Z",
    },
  ];
  const decisions = whoIsDue(synthetic, cronNow);
  const dueIds = decisions.filter((d) => d.decision.due).map((d) => d.user.id).sort();
  const skippedIds = decisions.filter((d) => !d.decision.due).map((d) => d.user.id).sort();
  check(
    "discovery: active yesterday and dormant months are due; 10-day weekly and onboarded-today are skipped",
    dueIds.join(",") === "active-yesterday,dormant-months" && skippedIds.join(",") === "brand-new,quiet-10d",
    `due=${dueIds.join(",")} skipped=${skippedIds.join(",")}`
  );
  const byId = Object.fromEntries(decisions.map((d) => [d.user.id, d.decision]));
  check("discovery: yesterday's modeller is daily", byId["active-yesterday"]?.cadence === "daily" && /daily due/.test(byId["active-yesterday"]?.reason ?? ""), JSON.stringify(byId["active-yesterday"]));
  check("discovery: 10-day-quiet is weekly and not yet due", byId["quiet-10d"]?.cadence === "weekly" && byId["quiet-10d"]?.due === false, JSON.stringify(byId["quiet-10d"]));
  check("discovery: brand-new onboarded today is skipped", byId["brand-new"]?.due === false && /already discovered today|weekly/.test(byId["brand-new"]?.reason ?? ""), JSON.stringify(byId["brand-new"]));
  check("discovery: dormant months is weekly due", byId["dormant-months"]?.cadence === "weekly" && byId["dormant-months"]?.due === true, JSON.stringify(byId["dormant-months"]));
  check(
    "discovery: never-discovered brand-new is due (connect cron backstop)",
    discoveryDue({ now: cronNow, lastSessionAt: null, lastDiscoveredAt: null }).due === true,
    JSON.stringify(discoveryDue({ now: cronNow, lastSessionAt: null, lastDiscoveredAt: null }))
  );
}

{
  const store: UserDataStore = {
    users: [{ id: "user-a", onshape_user_id: "osa" }],
    sessions: [
      { id: "s1", user_id: "user-a" },
      { id: "s2", user_id: "user-a" },
      { id: "s3", user_id: "user-a" },
    ],
    documents: [{ id: "d1", user_id: "user-a" }],
    streaks: [{ user_id: "user-a", current: 12 }],
    badges: [{ user_id: "user-a", id: "first" }],
    records: [{ user_id: "user-a", label: "Biggest day" }],
  };
  const b = applyOnshapeLogin(store, "osb", "user-b");
  check("login B creates a new user", b.created === true && b.userId === "user-b", JSON.stringify(b));
  check("login B sees zero sessions", sessionsFor(store, b.userId).length === 0, JSON.stringify({ userId: b.userId, sessions: sessionsFor(store, b.userId) }));
  check("login B does not inherit A's sessions", sessionsFor(store, "user-a").length === 3 && b.userId !== "user-a", JSON.stringify({ b, aSessions: sessionsFor(store, "user-a") }));
  check("login B does not inherit A's documents", store.documents.filter((d) => d.user_id === "user-b").length === 0 && store.documents.filter((d) => d.user_id === "user-a").length === 1, "");
  check("login B does not inherit A's streak/badges/records", store.streaks.every((s) => s.user_id === "user-a") && store.badges.every((x) => x.user_id === "user-a") && store.records.every((x) => x.user_id === "user-a"), "");
  const aAgain = applyOnshapeLogin(store, "osa", "should-not-use");
  check("login A again reuses A", aAgain.created === false && aAgain.userId === "user-a", JSON.stringify(aAgain));
  const aRow = store.users.find((u) => u.id === "user-a")!;
  check("bound A cannot be rebound to B's Onshape id", canRebindOnshapeId(aRow, "osb") === false, "");
  check("a null onshape_user_id row is not a bootstrap bind target", canRebindOnshapeId({ id: "orphan", onshape_user_id: null }, "osc") === false, "");
  const orphanStore: UserDataStore = {
    users: [{ id: "orphan", onshape_user_id: null }, { id: "user-a", onshape_user_id: "osa" }],
    sessions: [{ id: "s-orphan", user_id: "orphan" }],
    documents: [],
    streaks: [],
    badges: [],
    records: [],
  };
  const c = applyOnshapeLogin(orphanStore, "osc", "user-c");
  check("unbound existing row is not stolen by a new Onshape login", c.created === true && c.userId === "user-c" && orphanStore.users.some((u) => u.id === "orphan" && u.onshape_user_id === null), JSON.stringify(c));
}

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

{
  const env = {
    PUSH_VAPID_PUBLIC_KEY: "pub-key-value",
    PUSH_VAPID_PRIVATE_KEY: "SUPER_SECRET_PRIVATE_KEY",
  };
  const payload = clientPushConfig(env);
  check("client push config exposes the public key", payload.publicKey === "pub-key-value", JSON.stringify(payload));
  check(
    "client push config never includes the private key",
    !JSON.stringify(payload).includes("SUPER_SECRET_PRIVATE_KEY") && !Object.values(payload).includes("SUPER_SECRET_PRIVATE_KEY"),
    JSON.stringify(payload)
  );
  check("push is unavailable without keys", pushIsConfigured({}) === false && pushIsConfigured({ PUSH_VAPID_PUBLIC_KEY: "only-pub" }) === false, "");
  check("push is available when both VAPID keys exist", pushIsConfigured(env) === true, "");
}

{
  const idt2000 = "2026-09-12T17:00:00.000Z";
  const idt1959 = "2026-09-12T16:59:00.000Z";
  const ist2000 = "2026-01-15T18:00:00.000Z";
  const ist1959 = "2026-01-15T17:59:00.000Z";
  const idt0100 = "2026-09-11T22:00:00.000Z";
  check("20:00 IDT is past streak-risk hour", isPastStreakRiskHour(idt2000) === true, clockHmInZone(idt2000));
  check("19:59 IDT is not past streak-risk hour", isPastStreakRiskHour(idt1959) === false, clockHmInZone(idt1959));
  check("20:00 IST is past streak-risk hour", isPastStreakRiskHour(ist2000) === true, clockHmInZone(ist2000));
  check("19:59 IST is not past streak-risk hour", isPastStreakRiskHour(ist1959) === false, clockHmInZone(ist1959));
  const fire = (now: string, extra: Partial<Parameters<typeof streakAtRiskShouldFire>[0]> = {}) =>
    streakAtRiskShouldFire({ now, currentStreak: 5, todaySessionCount: 0, alreadySentToday: false, ...extra });
  check("streak at risk fires after 20:00 with an active streak and no session today", fire(idt2000) === true, "");
  check("streak at risk does not fire at 19:59", fire(idt1959) === false, "");
  check("streak at risk does not fire at 01:00 (new local day, before 20:00)", fire(idt0100) === false, clockHmInZone(idt0100));
  check("streak at risk does not fire with no streak", fire(idt2000, { currentStreak: 0 }) === false, "");
  check("streak at risk does not fire if a session already landed today", fire(idt2000, { todaySessionCount: 1 }) === false, "");
  check("streak at risk does not fire twice the same day", fire(idt2000, { alreadySentToday: true }) === false, "");
}

{
  const previous = [
    { userId: "me", weekMinutes: 40, name: "Yoni" },
    { userId: "ada", weekMinutes: 30, name: "Ada" },
  ];
  const passed = [
    { userId: "me", weekMinutes: 40, name: "Yoni" },
    { userId: "ada", weekMinutes: 45, name: "Ada" },
  ];
  const events = leagueOvertakes("me", previous, passed);
  check("league overtake fires when someone passes your weekly total", events.length === 1 && events[0]!.passerId === "ada", JSON.stringify(events));
  check(
    "league overtake does not fire when you stay ahead",
    leagueOvertakes("me", previous, [
      { userId: "me", weekMinutes: 50, name: "Yoni" },
      { userId: "ada", weekMinutes: 45, name: "Ada" },
    ]).length === 0,
    ""
  );
  check(
    "league overtake does not fire on the first snapshot (no previous)",
    leagueOvertakes("me", [], passed).length === 0,
    ""
  );
  check(
    "league overtake does not fire when the other person was already ahead",
    leagueOvertakes(
      "me",
      [
        { userId: "me", weekMinutes: 20, name: "Yoni" },
        { userId: "ada", weekMinutes: 50, name: "Ada" },
      ],
      [
        { userId: "me", weekMinutes: 25, name: "Yoni" },
        { userId: "ada", weekMinutes: 60, name: "Ada" },
      ]
    ).length === 0,
    ""
  );
  check(
    "league overtake fires when a tie becomes a pass",
    leagueOvertakes(
      "me",
      [
        { userId: "me", weekMinutes: 40, name: "Yoni" },
        { userId: "ada", weekMinutes: 40, name: "Ada" },
      ],
      [
        { userId: "me", weekMinutes: 40, name: "Yoni" },
        { userId: "ada", weekMinutes: 41, name: "Ada" },
      ]
    ).length === 1,
    ""
  );
  check(
    "league overtake does not fire when you pass them",
    leagueOvertakes(
      "me",
      [
        { userId: "me", weekMinutes: 30, name: "Yoni" },
        { userId: "ada", weekMinutes: 50, name: "Ada" },
      ],
      [
        { userId: "me", weekMinutes: 60, name: "Yoni" },
        { userId: "ada", weekMinutes: 50, name: "Ada" },
      ]
    ).length === 0,
    ""
  );
}

{
  const badges = [
    { id: "first", name: "First Extrude", earned: true },
    { id: "midnight", name: "After Midnight", earned: false },
  ];
  check(
    "badge push does not fire on the first snapshot of already-earned badges",
    badgeAwardsToNotify(null, badges).length === 0,
    JSON.stringify(badgeAwardsToNotify(null, badges))
  );
  check(
    "badge push does not fire before a badge is earned",
    badgeAwardsToNotify([], [{ id: "first", name: "First Extrude", earned: false }]).length === 0,
    ""
  );
  check(
    "badge push fires when a badge is newly awarded against a snapshot",
    badgeAwardsToNotify([], badges).map((b) => b.id).join(",") === "first",
    JSON.stringify(badgeAwardsToNotify([], badges))
  );
  check("badge push does not fire again for a badge already snapshotted", badgeAwardsToNotify(["first"], badges).length === 0, "");
  check(
    "badge push fires only the newly awarded id when two exist",
    badgeAwardsToNotify(["first"], [
      { id: "first", name: "First Extrude", earned: true },
      { id: "midnight", name: "After Midnight", earned: true },
    ]).map((b) => b.id).join(",") === "midnight",
    ""
  );
}

{
  check(
    "push dedupe keys differ across days so the same alert can fire tomorrow",
    pushDedupeKey("u1", "streak", "2026-09-11") !== pushDedupeKey("u1", "streak", "2026-09-12"),
    ""
  );
  check(
    "push dedupe keys differ by kind so a streak alert does not block a badge",
    pushDedupeKey("u1", "streak", "2026-09-11") !== pushDedupeKey("u1", "badge", "2026-09-11"),
    ""
  );
}

{
  const loggedOut = planJoinLanding({ code: "abc234", sessionUserId: null });
  check(
    "logged-out invite goes through /connect/ with the code in next",
    loggedOut.action === "connect" &&
      loggedOut.action === "connect" &&
      loggedOut.code === "ABC234" &&
      loggedOut.next === invitePath("ABC234") &&
      connectPathWithInvite("ABC234").includes(encodeURIComponent(invitePath("ABC234"))),
    JSON.stringify(loggedOut)
  );
  check(
    "logged-in invite joins as that session user, not a fallback",
    JSON.stringify(planJoinLanding({ code: "ABC234", sessionUserId: "user-b" })) ===
      JSON.stringify({ action: "join", code: "ABC234", userId: "user-b" }),
    ""
  );
  check("invite without a code is invalid", planJoinLanding({ code: null, sessionUserId: "user-b" }).action === "invalid", "");
  check("invite with junk is invalid", planJoinLanding({ code: "!!", sessionUserId: "user-b" }).action === "invalid", "");
  check("oauth start keeps the invite next", oauthStartPath(invitePath("ABC234")).includes("next="), "");
  check("oauth start ignores an open-redirect next", oauthStartPath("https://evil.example/") === "/api/auth/onshape/start", "");
  check("invite is not read from a non-join next", inviteCodeFromNext("/league/?code=ABC234") === null, "");
  check("protocol-relative next is rejected", safeNextPath("//evil.example/join/?code=ABC234") === null, "");
}

{
  check("first run is off once any session exists", firstRunCopy({ hasAnyData: true, onshapeConnected: false }) === null, "");
  const disconnected = firstRunCopy({ hasAnyData: false, onshapeConnected: false });
  check(
    "first run asks to connect Onshape when unbound",
    disconnected?.headline === "Connect Onshape to start" && disconnected.action?.href === "/connect/",
    JSON.stringify(disconnected)
  );
  const connected = firstRunCopy({ hasAnyData: false, onshapeConnected: true });
  check(
    "first run asks a connected user to go model, with no CTA to fake data",
    connected?.headline === "Go model something" && connected.action === null,
    JSON.stringify(connected)
  );
  check(
    "first run does not invent a streak or a zero score",
    !/[0-9]/.test(`${disconnected?.headline}${disconnected?.body}${connected?.headline}${connected?.body}`.replace(/Onshape|Xtrude/g, "")),
    JSON.stringify({ disconnected, connected })
  );
}

{
  const counted = countDocumentsFromEvents([
    { documentName: "Bearing Block" },
    { documentName: "Bearing Block" },
    { documentName: "Rover Chassis" },
    { documentName: "  " },
    { documentName: null },
  ]);
  check(
    "session docs count real events, skip nameless rows, and never invent a 0",
    counted.length === 2 &&
      counted.find((d) => d.name === "Bearing Block")?.edits === 2 &&
      counted.find((d) => d.name === "Rover Chassis")?.edits === 1 &&
      counted.every((d) => d.edits != null && d.edits > 0),
    JSON.stringify(counted)
  );
  const namedOnly = assembleSessionDocuments({
    eventNames: [],
    documentIds: ["doc1", "doc2"],
    nameByOnshapeId: new Map([["doc1", "Bearing Block"]]),
  });
  check(
    "session docs without events list names with unknown edits, not a fake 0",
    namedOnly.length === 2 &&
      namedOnly[0]?.name === "Bearing Block" &&
      namedOnly[0]?.edits === null &&
      namedOnly[1]?.name === "Unknown document" &&
      namedOnly[1]?.edits === null,
    JSON.stringify(namedOnly)
  );
  check("session qualifies at 2 events and 2 minutes", sessionQualification(2, 2).qualified === true, "");
  check("session does not qualify on event count alone", sessionQualification(1, 10).qualified === false, "");
  check("session does not qualify on span alone", sessionQualification(5, 1).qualified === false, "");
}

{
  check(
    "profile image is kept only when sessioninfo.image is an http(s) URL",
    profileImageUrlFromSession({ image: "https://cad.onshape.com/user.png" }) === "https://cad.onshape.com/user.png" &&
      profileImageUrlFromSession({ image: "http://example.com/a.png" }) === "http://example.com/a.png",
    ""
  );
  check(
    "profile image is skipped for non-URL sessioninfo.image values",
    profileImageUrlFromSession({ image: "cid:abc" }) === null &&
      profileImageUrlFromSession({ image: "/relative.png" }) === null &&
      profileImageUrlFromSession({ image: "user-id" }) === null &&
      profileImageUrlFromSession({}) === null &&
      profileImageUrlFromSession(null) === null,
    ""
  );
  check("sanitizeDisplayName trims and collapses spaces", sanitizeDisplayName("  Yoni   S  ") === "Yoni S", sanitizeDisplayName("  Yoni   S  "));
  check("sanitizeDisplayName rejects blank as empty when fallback is empty", sanitizeDisplayName("   ", "") === "", "");
  check("member since is month + year from created_at", memberSinceLabel("2026-03-15T12:00:00.000Z") === "March 2026", String(memberSinceLabel("2026-03-15T12:00:00.000Z")));
}

{
  const run = simulateCappedRun({ maxCalls: 100, plannedCalls: 150 });
  check("call cap default is 100", DEFAULT_MAX_CALLS_PER_RUN === 100, String(DEFAULT_MAX_CALLS_PER_RUN));
  check(
    "a 150-call run stops at 100 and logs where it stopped",
    run.completed === 100 &&
      run.callsUsed === 100 &&
      run.remaining === 50 &&
      run.log != null &&
      run.log.hit === true &&
      run.log.maxCalls === 100 &&
      typeof run.log.stoppedAt === "string" &&
      run.log.stoppedAt.length > 0,
    JSON.stringify(run)
  );
}

void (async () => {
  const now = 1_700_000_000_000;
  const expired = await withOAuthAccess({
    needsReauth: false,
    expiresAtMs: now,
    nowMs: now,
    getAccessToken: () => "stale",
    refresh: async () => ({ accessToken: "fresh" }),
    request: async (token) => {
      if (token !== "fresh") throw new Error("original request used the expired token");
      return `ok:${token}`;
    },
  });
  check(
    "expired OAuth token refreshes once then runs the original request",
    expired.status === "ok" && expired.refreshCalls === 1 && expired.requestCalls === 1 && expired.value === "ok:fresh",
    JSON.stringify(expired)
  );

  const failedRefresh = await withOAuthAccess({
    needsReauth: false,
    expiresAtMs: now,
    nowMs: now,
    getAccessToken: () => "stale",
    refresh: async () => {
      throw new Error("refresh HTTP 400");
    },
    request: async () => {
      throw new Error("Onshape should not be called after a failed refresh");
    },
  });
  check(
    "failed refresh marks needs-reauth and makes zero Onshape requests",
    failedRefresh.status === "needs_reauth" && failedRefresh.refreshCalls === 1 && failedRefresh.requestCalls === 0,
    JSON.stringify(failedRefresh)
  );

  const blocked = await withOAuthAccess({
    needsReauth: true,
    expiresAtMs: now + 3_600_000,
    nowMs: now,
    getAccessToken: () => "stale",
    refresh: async () => ({ accessToken: "fresh" }),
    request: async () => {
      throw new Error("Onshape should not be called while needs-reauth");
    },
  });
  check(
    "needs-reauth blocks further Onshape calls until reconnect",
    blocked.status === "blocked" && blocked.refreshCalls === 0 && blocked.requestCalls === 0,
    JSON.stringify(blocked)
  );

  const unauthorizedThenRetry = await withOAuthAccess({
    needsReauth: false,
    expiresAtMs: now + 3_600_000,
    nowMs: now,
    getAccessToken: () => "stale",
    refresh: async () => ({ accessToken: "fresh" }),
    request: async (token) => {
      if (token === "stale") throw new Error("HTTP 401 from GET /v6/documents");
      return "ok";
    },
  });
  check(
    "401 on a still-fresh access token refreshes once and retries the original request",
    unauthorizedThenRetry.status === "ok" &&
      unauthorizedThenRetry.refreshCalls === 1 &&
      unauthorizedThenRetry.requestCalls === 2 &&
      unauthorizedThenRetry.value === "ok",
    JSON.stringify(unauthorizedThenRetry)
  );

  const secret = "x".repeat(32);
  const uid = "e7b3c91a-4d2f-4a8e-9c15-6f8a2d4b1e70";
  const tok = await createSessionToken(uid, secret);
  check("session cookie roundtrip", (await readSessionUserId(tok, secret)) === uid, "");
  check("session cookie rejects a missing secret", (await readSessionUserId(tok, undefined)) === null, "");
  const tampered = tok.slice(0, -3) + "aaa";
  check("session cookie rejects tampering", (await readSessionUserId(tampered, secret)) === null, "");

  const issued = Math.floor(Date.now() / 1000) - 10;
  const logoutAt = issued + 5;
  const oldCookie = await createSessionToken(uid, secret, issued);
  check(
    "old cookie is still HMAC-valid after sign-out (replay is why we need a server stamp)",
    (await readSessionUserId(oldCookie, secret)) === uid,
    ""
  );
  check(
    "after sign-out, a request carrying the old cookie is treated as unauthenticated",
    (await authenticatedUserId(oldCookie, secret, logoutAt)) === null,
    String(await authenticatedUserId(oldCookie, secret, logoutAt))
  );
  check(
    "the same cookie stays authenticated if the user never signed out",
    (await authenticatedUserId(oldCookie, secret, null)) === uid,
    ""
  );
  const reconnected = await createSessionToken(uid, secret, logoutAt + 1);
  check(
    "a new session after reconnect is authenticated",
    (await authenticatedUserId(reconnected, secret, logoutAt)) === uid,
    ""
  );

  const prevAuth = process.env.REQUIRE_AUTH;
  const prevSecret = process.env.AUTH_SECRET;
  process.env.REQUIRE_AUTH = "1";
  process.env.AUTH_SECRET = secret;
  try {
    const loggedOut = (path: string) => new NextRequest(new URL(path, "http://localhost:3000"));
    let sessionsRes: Response | null = null;
    let threw = false;
    try {
      sessionsRes = await proxy(loggedOut("/sessions/"));
    } catch {
      threw = true;
    }
    check(
      "REQUIRE_AUTH=1 sends a logged-out /sessions/ to /connect/ rather than erroring",
      !threw && sessionsRes != null && sessionsRes.status >= 300 && sessionsRes.status < 400 && (sessionsRes.headers.get("location") ?? "").includes("/connect"),
      `threw=${threw} status=${sessionsRes?.status} loc=${sessionsRes?.headers.get("location")}`
    );
    const homeRes = await proxy(loggedOut("/"));
    check(
      "REQUIRE_AUTH=1 sends a logged-out / to /connect/",
      homeRes.status >= 300 && homeRes.status < 400 && (homeRes.headers.get("location") ?? "").includes("/connect"),
      `status=${homeRes.status} loc=${homeRes.headers.get("location")}`
    );
    const joinRes = await proxy(loggedOut("/join/?code=ABC234"));
    check(
      "REQUIRE_AUTH=1 leaves /join/ public so the invite query is not stripped",
      isPublicPath("/join/") && joinRes.status < 300 && !(joinRes.headers.get("location") ?? "").includes("/connect"),
      `status=${joinRes.status} loc=${joinRes.headers.get("location")}`
    );
    const adminRes = await proxy(loggedOut("/admin/"));
    check(
      "REQUIRE_AUTH=1 still lets the owner reach /admin",
      adminRes.status < 300 && !(adminRes.headers.get("location") ?? "").includes("/connect") && isPublicPath("/admin/"),
      `status=${adminRes.status} loc=${adminRes.headers.get("location")}`
    );
    const replay = new NextRequest(new URL("/sessions/", "http://localhost:3000"), {
      headers: { cookie: `${SESSION_COOKIE}=${oldCookie}` },
    });
    const replayRes = await proxy(replay, { loggedOutAt: async () => logoutAt });
    check(
      "REQUIRE_AUTH=1 treats a signed-out cookie on /sessions/ as logged out",
      replayRes.status >= 300 && replayRes.status < 400 && (replayRes.headers.get("location") ?? "").includes("/connect"),
      `status=${replayRes.status} loc=${replayRes.headers.get("location")}`
    );
    const liveRes = await proxy(replay, { loggedOutAt: async () => null });
    check(
      "REQUIRE_AUTH=1 still accepts a live cookie on /sessions/",
      liveRes.status < 300 && !(liveRes.headers.get("location") ?? "").includes("/connect"),
      `status=${liveRes.status} loc=${liveRes.headers.get("location")}`
    );
  } finally {
    if (prevAuth === undefined) delete process.env.REQUIRE_AUTH;
    else process.env.REQUIRE_AUTH = prevAuth;
    if (prevSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = prevSecret;
  }

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks pass.");
  process.exit(failures ? 1 : 0);
})();

