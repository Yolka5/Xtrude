import "server-only";
import { getSupabase } from "./client";
import {
  handleCandidateAt,
  handleStemFromIdentity,
  handleTakenKey,
  handleUserKey,
  planHandleClaim,
  sanitizeHandle,
  type HandleIdentity,
} from "@/lib/profileFields";

export async function getHandlesForUsers(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data } = await getSupabase()
    .from("app_state")
    .select("key, value")
    .in("key", unique.map((id) => handleUserKey(id)));
  for (const row of data ?? []) {
    const userId = String(row.key).replace(/^handle_user_/, "");
    const handle = sanitizeHandle(String((row.value as { handle?: unknown } | null)?.handle ?? ""));
    if (handle) out.set(userId, handle);
  }
  return out;
}

export async function getHandleForUser(userId: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from("app_state")
    .select("value")
    .eq("key", handleUserKey(userId))
    .maybeSingle();
  const raw = (data?.value as { handle?: unknown } | null)?.handle;
  return typeof raw === "string" ? sanitizeHandle(raw) : null;
}

async function takenBy(handle: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from("app_state")
    .select("value")
    .eq("key", handleTakenKey(handle))
    .maybeSingle();
  const userId = (data?.value as { userId?: unknown } | null)?.userId;
  return typeof userId === "string" && userId.length > 0 ? userId : null;
}

export async function claimHandle(userId: string, raw: string): Promise<{ handle: string }> {
  const preview = planHandleClaim({ userId, raw, takenBy: null });
  if (!preview.ok) throw new Error(preview.reason);
  const owner = await takenBy(preview.handle);
  const planned = planHandleClaim({ userId, raw, takenBy: owner });
  if (!planned.ok) throw new Error(planned.reason);

  const previous = await getHandleForUser(userId);
  const now = new Date().toISOString();
  const sb = getSupabase();

  if (previous && previous !== planned.handle) {
    await sb.from("app_state").delete().eq("key", handleTakenKey(previous));
  }

  const { error: takenErr } = await sb.from("app_state").upsert({
    key: handleTakenKey(planned.handle),
    value: { userId },
    updated_at: now,
  });
  if (takenErr) throw new Error(takenErr.message);

  const confirm = await takenBy(planned.handle);
  if (confirm !== userId) {
    throw new Error("That @ is taken.");
  }

  const { error: userErr } = await sb.from("app_state").upsert({
    key: handleUserKey(userId),
    value: { handle: planned.handle },
    updated_at: now,
  });
  if (userErr) throw new Error(userErr.message);
  return { handle: planned.handle };
}

export async function claimAvailableHandle(userId: string, stem: string): Promise<string | null> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = handleCandidateAt(stem, attempt);
    if (!candidate) continue;
    try {
      const claimed = await claimHandle(userId, candidate);
      return claimed.handle;
    } catch (err) {
      if (err instanceof Error && err.message === "That @ is taken.") continue;
      throw err;
    }
  }
  return null;
}

/** Give this account its own @ from Onshape / display name if it has none yet. */
export async function ensureHandleForUser(userId: string, identity?: HandleIdentity): Promise<string | null> {
  const existing = await getHandleForUser(userId);
  if (existing) return existing;

  let info = identity;
  if (!info?.name && !info?.firstName && !info?.email) {
    const { data } = await getSupabase()
      .from("users")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    const displayName = typeof data?.display_name === "string" ? data.display_name : "";
    info = { name: displayName, firstName: displayName.split(/\s+/)[0] };
  }

  const stem = handleStemFromIdentity(info ?? {});
  if (!stem) return null;
  return claimAvailableHandle(userId, stem);
}
