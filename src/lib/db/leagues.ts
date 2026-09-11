import "server-only";
import { getSupabase } from "./client";
import type { League } from "@/lib/fixtures";
import {
  generateJoinCode,
  minutesInDateRange,
  rankStandings,
  weekWindow,
  type StandingInput,
} from "@/lib/leagueStandings";

export type LeagueSummary = { id: string; name: string; joinCode: string };

export type LeagueView = League & {
  id: string | null;
  joinCode: string | null;
  isOwner: boolean;
  allLeagues: LeagueSummary[];
  tablesReady: boolean;
};

function isMissingTable(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("could not find the table") ||
    m.includes("schema cache")
  );
}

async function sessionsForUsers(userIds: string[]) {
  if (userIds.length === 0) return [];
  const { data, error } = await getSupabase()
    .from("sessions")
    .select("user_id, started_at, scored_minutes")
    .in("user_id", userIds);
  if (error) throw new Error(`loading league sessions: ${error.message}`);
  return (data ?? []) as { user_id: string; started_at: string; scored_minutes: number }[];
}

function standingsFromRows(
  people: { id: string; display_name: string; initials: string }[],
  sessionRows: { user_id: string; started_at: string; scored_minutes: number }[],
  meId: string,
  weekStart: string,
  today: string,
  lastWeekStart: string,
  lastWeekEnd: string
) {
  const byUser = new Map<string, { started_at: string; scored_minutes: number }[]>();
  for (const row of sessionRows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }
  const inputs: StandingInput[] = people.map((p) => {
    const mine = byUser.get(p.id) ?? [];
    const week = minutesInDateRange(mine, weekStart, today);
    const last = minutesInDateRange(mine, lastWeekStart, lastWeekEnd);
    return {
      userId: p.id,
      name: p.display_name,
      initials: p.initials,
      weekMinutes: week.minutes,
      weekSessions: week.sessions,
      lastWeekMinutes: last.minutes,
    };
  });
  return rankStandings(inputs, meId);
}

async function soloFromUser(userId: string): Promise<LeagueView> {
  const { today, weekStart, lastWeekStart, lastWeekEnd, daysElapsed } = weekWindow(Date.now());
  const [{ data: user }, sessionRows] = await Promise.all([
    getSupabase().from("users").select("id, display_name, initials").eq("id", userId).maybeSingle(),
    sessionsForUsers([userId]),
  ]);
  const person = {
    id: userId,
    display_name: (user?.display_name as string | undefined) ?? "You",
    initials: (user?.initials as string | undefined) ?? "YO",
  };
  const members = standingsFromRows(
    [person],
    sessionRows,
    userId,
    weekStart,
    today,
    lastWeekStart,
    lastWeekEnd
  );
  return {
    id: null,
    name: person.display_name || "League",
    memberCount: 1,
    daysElapsed,
    members,
    joinCode: null,
    isOwner: false,
    allLeagues: [],
    tablesReady: false,
  };
}

/**
 * The league the current user should see. Prefers the oldest membership.
 * If `leagues` hasn't been migrated yet, synthesizes a one-person board
 * named after the owner (never a hardcoded product name) so the screen
 * stays honest instead of 500ing or falling back to fixture names.
 */
export async function getLeagueView(userId: string, leagueId?: string | null): Promise<LeagueView> {
  const { today, weekStart, lastWeekStart, lastWeekEnd, daysElapsed } = weekWindow(Date.now());
  const sb = getSupabase();

  const membership = await sb
    .from("league_members")
    .select("league_id, joined_at, leagues(id, name, join_code, created_by)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });

  if (membership.error) {
    if (isMissingTable(membership.error.message)) return soloFromUser(userId);
    throw new Error(`loading league membership: ${membership.error.message}`);
  }

  const rows = membership.data ?? [];
  if (rows.length === 0) return { ...(await soloFromUser(userId)), tablesReady: true };

  const summaries: LeagueSummary[] = [];
  for (const row of rows) {
    const league = row.leagues as { id: string; name: string; join_code: string; created_by: string } | null;
    if (!league) continue;
    summaries.push({ id: league.id, name: league.name, joinCode: league.join_code });
  }
  if (summaries.length === 0) return { ...(await soloFromUser(userId)), tablesReady: true };

  const active =
    (leagueId && summaries.find((l) => l.id === leagueId)) || summaries[0];
  const activeRow = rows.find((row) => {
    const league = row.leagues as { id: string } | null;
    return league?.id === active.id;
  });
  const createdBy = (activeRow?.leagues as { created_by?: string } | null)?.created_by;

  const membersRes = await sb
    .from("league_members")
    .select("user_id, users(id, display_name, initials)")
    .eq("league_id", active.id);
  if (membersRes.error) throw new Error(`loading league members: ${membersRes.error.message}`);

  const people: { id: string; display_name: string; initials: string }[] = [];
  for (const row of membersRes.data ?? []) {
    const u = row.users as { id: string; display_name: string; initials: string } | null;
    if (u) people.push(u);
    else people.push({ id: row.user_id as string, display_name: "Member", initials: "?" });
  }

  const sessionRows = await sessionsForUsers(people.map((p) => p.id));
  const members = standingsFromRows(
    people,
    sessionRows,
    userId,
    weekStart,
    today,
    lastWeekStart,
    lastWeekEnd
  );

  return {
    id: active.id,
    name: active.name,
    memberCount: members.length,
    daysElapsed,
    members,
    joinCode: active.joinCode,
    isOwner: createdBy === userId,
    allLeagues: summaries,
    tablesReady: true,
  };
}

export async function createLeague(userId: string, rawName: string): Promise<{ id: string; joinCode: string }> {
  const name = rawName.trim().slice(0, 48);
  if (name.length < 2) throw new Error("Name needs at least 2 characters.");
  const sb = getSupabase();
  for (let attempt = 0; attempt < 6; attempt++) {
    const joinCode = generateJoinCode();
    const { data, error } = await sb
      .from("leagues")
      .insert({ name, join_code: joinCode, created_by: userId })
      .select("id, join_code")
      .single();
    if (error) {
      if (isMissingTable(error.message)) throw new Error("Run supabase/migrate-leagues.sql first.");
      if (/duplicate|unique/i.test(error.message)) continue;
      throw new Error(error.message);
    }
    const { error: memberErr } = await sb
      .from("league_members")
      .insert({ league_id: data.id, user_id: userId });
    if (memberErr) throw new Error(memberErr.message);
    return { id: data.id as string, joinCode: data.join_code as string };
  }
  throw new Error("Could not allocate a join code.");
}

export async function joinLeagueByCode(userId: string, rawCode: string): Promise<{ id: string }> {
  const code = rawCode.trim().toUpperCase();
  if (code.length < 4) throw new Error("That join code is too short.");
  const sb = getSupabase();
  const { data: league, error } = await sb
    .from("leagues")
    .select("id")
    .eq("join_code", code)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error.message)) throw new Error("Run supabase/migrate-leagues.sql first.");
    throw new Error(error.message);
  }
  if (!league) throw new Error("No league uses that code.");
  const { error: memberErr } = await sb
    .from("league_members")
    .upsert({ league_id: league.id, user_id: userId }, { onConflict: "league_id,user_id" });
  if (memberErr) throw new Error(memberErr.message);
  return { id: league.id as string };
}

export async function leaveLeague(userId: string, leagueId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("league_members")
    .delete()
    .eq("league_id", leagueId)
    .eq("user_id", userId);
  if (error) {
    if (isMissingTable(error.message)) throw new Error("Run supabase/migrate-leagues.sql first.");
    throw new Error(error.message);
  }
}

async function requireOwnedLeague(userId: string, leagueId: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("leagues")
    .select("id, name, join_code, created_by")
    .eq("id", leagueId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error.message)) throw new Error("Run supabase/migrate-leagues.sql first.");
    throw new Error(error.message);
  }
  if (!data) throw new Error("League not found.");
  if (data.created_by !== userId) throw new Error("Only the owner can do that.");
  return data;
}

export async function renameLeague(
  userId: string,
  leagueId: string,
  rawName: string
): Promise<{ id: string; name: string; joinCode: string }> {
  const name = rawName.trim().slice(0, 48);
  if (name.length < 2) throw new Error("Name needs at least 2 characters.");
  const league = await requireOwnedLeague(userId, leagueId);
  const { error } = await getSupabase().from("leagues").update({ name }).eq("id", leagueId);
  if (error) throw new Error(error.message);
  return { id: leagueId, name, joinCode: league.join_code as string };
}

export async function regenerateLeagueJoinCode(
  userId: string,
  leagueId: string
): Promise<{ id: string; joinCode: string }> {
  await requireOwnedLeague(userId, leagueId);
  const sb = getSupabase();
  for (let attempt = 0; attempt < 6; attempt++) {
    const joinCode = generateJoinCode();
    const { error } = await sb.from("leagues").update({ join_code: joinCode }).eq("id", leagueId);
    if (error) {
      if (/duplicate|unique/i.test(error.message)) continue;
      throw new Error(error.message);
    }
    return { id: leagueId, joinCode };
  }
  throw new Error("Could not allocate a join code.");
}

