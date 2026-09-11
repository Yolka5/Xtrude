/**
 * Pure Onshape-login binding. Never attach a new Onshape identity to an
 * existing user row: a match is only `users.onshape_user_id === id`.
 * A miss always inserts an empty user. Rows with a non-null
 * onshape_user_id cannot be rebound.
 */
export type BoundUser = {
  id: string;
  onshape_user_id: string | null;
};

export type LoginPlan =
  | { action: "reuse"; userId: string }
  | { action: "insert" };

export function planOnshapeLogin(onshapeUserId: string, users: BoundUser[]): LoginPlan {
  const match = users.find((u) => u.onshape_user_id === onshapeUserId);
  if (match) return { action: "reuse", userId: match.id };
  return { action: "insert" };
}

export type UserDataStore = {
  users: BoundUser[];
  sessions: { id: string; user_id: string }[];
  documents: { id: string; user_id: string }[];
  streaks: { user_id: string; current: number }[];
  badges: { user_id: string; id: string }[];
  records: { user_id: string; label: string }[];
};

export function applyOnshapeLogin(
  store: UserDataStore,
  onshapeUserId: string,
  newUserId: string
): { userId: string; created: boolean } {
  const plan = planOnshapeLogin(onshapeUserId, store.users);
  if (plan.action === "reuse") return { userId: plan.userId, created: false };
  store.users.push({ id: newUserId, onshape_user_id: onshapeUserId });
  return { userId: newUserId, created: true };
}

export function sessionsFor(store: UserDataStore, userId: string) {
  return store.sessions.filter((s) => s.user_id === userId);
}

/** A bound row must never have its Onshape id overwritten. */
export function canRebindOnshapeId(user: BoundUser, nextOnshapeId: string): boolean {
  if (user.onshape_user_id == null) return false;
  return user.onshape_user_id === nextOnshapeId;
}
