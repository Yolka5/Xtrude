import { handleCandidateAt, planHandleClaim } from "@/lib/profileFields";

/**
 * @ claims, storage-agnostic so the rules run in scripts/verify-derive.ts.
 *
 * Ownership is decided by one atomic write: `reserve` inserts the handle's
 * reservation and reports "conflict" if one already exists - it never
 * overwrites. There is deliberately no write-then-read confirm step. Inside
 * a server render Next memoizes identical GET fetches, so a confirm read can
 * return the pre-write answer; that is how one account walked moochah →
 * moochah20 reserving every one, and how other accounts were left with no @.
 */
export type HandleStore = {
  /** Insert-only. "conflict" when the handle already has a reservation. */
  reserve(handle: string, userId: string): Promise<"ok" | "conflict">;
  ownerOf(handle: string): Promise<string | null>;
  currentHandle(userId: string): Promise<string | null>;
  setCurrentHandle(userId: string, handle: string): Promise<void>;
  /** Drops the reservation only if `userId` is the one holding it. */
  release(handle: string, userId: string): Promise<void>;
};

export const HANDLE_TAKEN = "That @ is taken.";

export async function claimHandleIn(store: HandleStore, userId: string, raw: string): Promise<{ handle: string }> {
  const planned = planHandleClaim({ userId, raw, takenBy: null });
  if (!planned.ok) throw new Error(planned.reason);
  const { handle } = planned;

  if ((await store.reserve(handle, userId)) === "conflict" && (await store.ownerOf(handle)) !== userId) {
    throw new Error(HANDLE_TAKEN);
  }

  const previous = await store.currentHandle(userId);
  await store.setCurrentHandle(userId, handle);
  if (previous && previous !== handle) await store.release(previous, userId);
  return { handle };
}

/** First free @ from a stem: stem, stem2, stem3... Null if none of them are free. */
export async function claimAvailableHandleIn(
  store: HandleStore,
  userId: string,
  stem: string,
  attempts = 20
): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const candidate = handleCandidateAt(stem, attempt);
    if (!candidate) continue;
    try {
      return (await claimHandleIn(store, userId, candidate)).handle;
    } catch (err) {
      if (err instanceof Error && err.message === HANDLE_TAKEN) continue;
      throw err;
    }
  }
  return null;
}
