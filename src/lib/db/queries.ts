import "server-only";
import { getSupabase } from "./client";
import { deriveRealData, type RealData } from "./derive";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { assembleSessionDocuments, sessionQualification, type SessionDocCount } from "@/lib/sessionDetail";
import { calendarDateInZone, clockHmInZone } from "../../../scripts/lib/timezone.mjs";
import { lastSyncKey } from "../../../scripts/lib/userScope.mjs";
import { storedOnshapeImageUrl } from "@/lib/auth/tokens";
import { memberSinceLabel, sanitizeDisplayName } from "@/lib/profileFields";
import { initialsFromDisplayName } from "@/lib/localProfile";
import { getHandleForUser } from "@/lib/db/handles";

export type { RealData };

/**
 * Thin I/O shell: fetches the three small tables this app reads and hands
 * them to the pure `deriveRealData` (see derive.ts) for everything else.
 * Kept this way so the derivation logic - streak math, records, badge
 * claims - is unit-testable with synthetic rows (scratch-verify.ts) instead
 * of only ever being exercised against a live Supabase project.
 */
export async function getRealData(): Promise<RealData> {
  const todayMs = Date.now();
  const userId = await getCurrentUserId();

  const [sessionsRes, dailyRes, docsRes] = await Promise.all([
    getSupabase().from("sessions").select("*").eq("user_id", userId).order("started_at", { ascending: false }),
    getSupabase().from("daily_stats").select("*").eq("user_id", userId).order("date", { ascending: true }),
    getSupabase().from("tracked_documents").select("id, onshape_document_id, name").eq("user_id", userId),
  ]);
  if (sessionsRes.error) throw new Error(`loading sessions: ${sessionsRes.error.message}`);
  if (dailyRes.error) throw new Error(`loading daily_stats: ${dailyRes.error.message}`);
  if (docsRes.error) throw new Error(`loading tracked_documents: ${docsRes.error.message}`);

  const docNameById = new Map(
    (docsRes.data ?? []).map((d) => [d.onshape_document_id as string, d.name as string])
  );

  return deriveRealData(sessionsRes.data ?? [], dailyRes.data ?? [], docNameById, todayMs);
}

/** Whether the current viewer is bound to an Onshape account. Used by Today
 * so a first-run empty state can ask them to connect vs go model. */
export async function hasOnshapeBinding(): Promise<boolean> {
  const userId = await getCurrentUserId();
  try {
    const { data, error } = await getSupabase()
      .from("users")
      .select("onshape_user_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) return false;
    return Boolean(data?.onshape_user_id);
  } catch {
    return false;
  }
}

/** When this user's own documents last synced, or null if never. Used by
 * Today to decide whether to fire a background sync without blocking
 * render. Per user: another account's sync says nothing about yours. */
export async function getLastSyncAt(userId: string): Promise<number | null> {
  try {
    const { data, error } = await getSupabase()
      .from("app_state")
      .select("updated_at")
      .eq("key", lastSyncKey(userId))
      .maybeSingle();
    if (error || !data?.updated_at) return null;
    const ms = Date.parse(data.updated_at as string);
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

export type SessionDetail = {
  id: string;
  date: string;
  start: string;
  end: string;
  rawMinutes: number;
  scoredMinutes: number;
  leadInMinutes: number;
  eventCount: number;
  verified: boolean;
  documents: SessionDocCount[];
  qualification: ReturnType<typeof sessionQualification>;
};

/**
 * One session from `sessions` plus the events that fell in its timestamp
 * range. Document edit counts are real event totals. If events are missing
 * we still list `document_ids` by name, with `edits: null` — never a fake 0.
 */
export async function getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const userId = await getCurrentUserId();
  const sb = getSupabase();
  const { data: row, error } = await sb
    .from("sessions")
    .select("id, started_at, ended_at, raw_minutes, scored_minutes, event_count, document_ids")
    .eq("user_id", userId)
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !row) return null;

  const { data: eventRows } = await sb
    .from("events")
    .select("occurred_at, tracked_documents(name)")
    .eq("user_id", userId)
    .gte("occurred_at", row.started_at)
    .lte("occurred_at", row.ended_at)
    .order("occurred_at", { ascending: true });

  const documentIds = Array.isArray(row.document_ids) ? (row.document_ids as string[]) : [];
  const { data: docs } = documentIds.length
    ? await sb
        .from("tracked_documents")
        .select("onshape_document_id, name")
        .eq("user_id", userId)
        .in("onshape_document_id", documentIds)
    : { data: [] as { onshape_document_id: string; name: string }[] };

  const nameByOnshapeId = new Map(
    (docs ?? []).map((d) => [d.onshape_document_id as string, d.name as string])
  );
  const eventNames = (eventRows ?? []).map((ev) => ({
    documentName:
      (ev as unknown as { tracked_documents: { name: string } | null }).tracked_documents?.name ?? null,
  }));

  const eventCount = Math.round(Number(row.event_count) || 0);
  const rawMinutes = Math.round(Number(row.raw_minutes) || 0);
  const start = new Date(row.started_at as string);
  const end = new Date(row.ended_at as string);

  return {
    id: row.id as string,
    date: calendarDateInZone(start),
    start: clockHmInZone(start),
    end: clockHmInZone(end),
    rawMinutes,
    scoredMinutes: Math.round(Number(row.scored_minutes) || 0),
    leadInMinutes: 5,
    eventCount,
    verified: false,
    documents: assembleSessionDocuments({ eventNames, documentIds, nameByOnshapeId }),
    qualification: sessionQualification(eventCount, rawMinutes),
  };
}

export type AccountProfile = {
  displayName: string;
  memberSince: string;
  imageUrl: string | null;
  handle: string | null;
};

export async function getAccountProfile(): Promise<AccountProfile> {
  const userId = await getCurrentUserId();
  const { data } = await getSupabase()
    .from("users")
    .select("display_name, created_at")
    .eq("id", userId)
    .maybeSingle();
  const [imageUrl, handle] = await Promise.all([storedOnshapeImageUrl(userId), getHandleForUser(userId)]);
  return {
    displayName: typeof data?.display_name === "string" && data.display_name.trim() ? data.display_name : "You",
    memberSince: memberSinceLabel(data?.created_at as string | undefined) ?? "-",
    imageUrl,
    handle,
  };
}

export async function updateUserDisplayName(raw: string): Promise<{ displayName: string; initials: string }> {
  const userId = await getCurrentUserId();
  const displayName = sanitizeDisplayName(raw, "");
  if (!displayName) throw new Error("Display name cannot be empty.");
  const initials = initialsFromDisplayName(displayName);
  const { error } = await getSupabase()
    .from("users")
    .update({ display_name: displayName, initials })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  return { displayName, initials };
}
