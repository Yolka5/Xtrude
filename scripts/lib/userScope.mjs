/**
 * Every per-user job names its user. There is no default account: a
 * missing id throws before anything is read, written, or wiped, so nothing
 * is silently credited to (or deleted from) someone else.
 */
export function requireUserId(userId, where) {
  if (typeof userId !== "string" || userId.length === 0) {
    throw new Error(`${where}: userId is required (there is no default user)`);
  }
  return userId;
}

/**
 * The Onshape user id bound to this Xtrude user. documenthistory on a
 * shared document lists every collaborator's microversions; only rows whose
 * `userId` is this id are this person's work.
 */
export async function loadOnshapeUserId(supabase, userId) {
  requireUserId(userId, "loadOnshapeUserId");
  const { data, error } = await supabase.from("users").select("onshape_user_id").eq("id", userId).maybeSingle();
  if (error) throw new Error(`loading onshape_user_id: ${error.message}`);
  const id = data?.onshape_user_id;
  if (typeof id !== "string" || id.length === 0) {
    throw new Error(`user ${userId} has no Onshape account bound; refusing to attribute edits`);
  }
  return id;
}

/** Whether a documenthistory row is an edit this Onshape user made. */
export function authoredBy(row, onshapeUserId) {
  return Boolean(onshapeUserId) && row?.userId === onshapeUserId;
}

/** Per-user sync stamp in app_state. Someone else's sync says nothing about yours. */
export function lastSyncKey(userId) {
  return `last_sync_${requireUserId(userId, "lastSyncKey")}`;
}
