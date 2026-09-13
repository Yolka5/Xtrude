import "server-only";
import { getSupabase } from "./client";
import { claimAvailableHandleIn, claimHandleIn, type HandleStore } from "@/lib/handleClaim";
import {
  handleStemFromIdentity,
  handleTakenKey,
  handleUserKey,
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

/**
 * A fresh signal opts a read out of Next's per-render GET memoization, so
 * it reflects writes made earlier in the same render.
 */
function unmemoized(): AbortSignal {
  return new AbortController().signal;
}

const store: HandleStore = {
  async reserve(handle, userId) {
    const { error } = await getSupabase()
      .from("app_state")
      .insert({ key: handleTakenKey(handle), value: { userId }, updated_at: new Date().toISOString() });
    if (!error) return "ok";
    if (error.code === "23505") return "conflict";
    throw new Error(error.message);
  },
  async ownerOf(handle) {
    const { data, error } = await getSupabase()
      .from("app_state")
      .select("value")
      .eq("key", handleTakenKey(handle))
      .abortSignal(unmemoized())
      .maybeSingle();
    if (error) throw new Error(error.message);
    const userId = (data?.value as { userId?: unknown } | null)?.userId;
    return typeof userId === "string" && userId.length > 0 ? userId : null;
  },
  async currentHandle(userId) {
    const { data, error } = await getSupabase()
      .from("app_state")
      .select("value")
      .eq("key", handleUserKey(userId))
      .abortSignal(unmemoized())
      .maybeSingle();
    if (error) throw new Error(error.message);
    const raw = (data?.value as { handle?: unknown } | null)?.handle;
    return typeof raw === "string" ? sanitizeHandle(raw) : null;
  },
  async setCurrentHandle(userId, handle) {
    const { error } = await getSupabase().from("app_state").upsert({
      key: handleUserKey(userId),
      value: { handle },
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  },
  async release(handle, userId) {
    await getSupabase().from("app_state").delete().eq("key", handleTakenKey(handle)).eq("value->>userId", userId);
  },
};

export async function claimHandle(userId: string, raw: string): Promise<{ handle: string }> {
  return claimHandleIn(store, userId, raw);
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
  try {
    return await claimAvailableHandleIn(store, userId, stem);
  } catch (err) {
    // A failed automatic claim sends the person to /welcome to pick one,
    // never onto a page with a 500 or someone else's @.
    console.error("automatic @ claim failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
