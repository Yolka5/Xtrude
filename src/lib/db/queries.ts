import "server-only";
import { getSupabase } from "./client";
import { deriveRealData, type RealData } from "./derive";
import type { TouchedDocument } from "@/lib/fixtures";

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

  const [sessionsRes, dailyRes, docsRes] = await Promise.all([
    getSupabase().from("sessions").select("*").order("started_at", { ascending: false }),
    getSupabase().from("daily_stats").select("*").order("date", { ascending: true }),
    getSupabase().from("tracked_documents").select("id, onshape_document_id, name"),
  ]);
  if (sessionsRes.error) throw new Error(`loading sessions: ${sessionsRes.error.message}`);
  if (dailyRes.error) throw new Error(`loading daily_stats: ${dailyRes.error.message}`);
  if (docsRes.error) throw new Error(`loading tracked_documents: ${docsRes.error.message}`);

  const docNameById = new Map(
    (docsRes.data ?? []).map((d) => [d.onshape_document_id as string, d.name as string])
  );

  return deriveRealData(sessionsRes.data ?? [], dailyRes.data ?? [], docNameById, todayMs);
}

/** Session detail needs a real per-document edit breakdown, which the
 * `sessions` table doesn't store (only the document id list) - this range
 * query over `events` reproduces it exactly, since a session's own events
 * are, by construction, every event between its start and end timestamps.
 * Looks the session's raw timestamps up by id rather than reconstructing
 * them from the display-oriented `Session` type (date + "HH:MM" strings,
 * which lose the actual day boundary for a session that runs past
 * midnight). Falls back to `fallback` (edits: 0 placeholders) on any error
 * so a lookup failure degrades to "no breakdown," never a broken page. */
export async function getSessionDocuments(sessionId: string, fallback: TouchedDocument[]): Promise<TouchedDocument[]> {
  const { data: sessionRow, error: sessionErr } = await getSupabase()
    .from("sessions")
    .select("started_at, ended_at")
    .eq("id", sessionId)
    .single();
  if (sessionErr || !sessionRow) return fallback;

  const { data, error } = await getSupabase()
    .from("events")
    .select("occurred_at, tracked_documents(name)")
    .gte("occurred_at", sessionRow.started_at)
    .lte("occurred_at", sessionRow.ended_at)
    .order("occurred_at", { ascending: true });
  if (error || !data) return fallback;

  const counts = new Map<string, number>();
  for (const row of data) {
    const name = (row as unknown as { tracked_documents: { name: string } | null }).tracked_documents?.name;
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return fallback;
  return [...counts.entries()].map(([name, edits]) => ({ name, tab: "", edits }));
}
