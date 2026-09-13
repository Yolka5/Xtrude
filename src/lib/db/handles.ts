import "server-only";
import { getSupabase } from "./client";
import {
  handleTakenKey,
  handleUserKey,
  planHandleClaim,
  sanitizeHandle,
} from "@/lib/profileFields";

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
