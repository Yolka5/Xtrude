import "server-only";
import { getSupabase } from "@/lib/db/client";
import { APP_USER_ID } from "../../../scripts/lib/appUser.mjs";
import {
  displayNameFromSession,
  initialsFromName,
  type OnshapeSessionInfo,
} from "./onshape";

const DEFAULT_AVATAR = "#2b2b30";

export async function upsertUserFromOnshape(info: OnshapeSessionInfo): Promise<{ id: string; created: boolean }> {
  const sb = getSupabase();
  const onshapeId = String(info.id);
  const name = displayNameFromSession(info);
  const initials = initialsFromName(name);

  const { data: existing, error: existingErr } = await sb
    .from("users")
    .select("id")
    .eq("onshape_user_id", onshapeId)
    .maybeSingle();
  if (existingErr) throw new Error(`looking up user: ${existingErr.message}`);
  if (existing?.id) return { id: existing.id as string, created: false };

  // First OAuth on this project: bind the Onshape account to Yoni's existing
  // row (sessions, documents, webhooks) instead of creating an empty twin.
  const { data: yoni } = await sb
    .from("users")
    .select("id, onshape_user_id")
    .eq("id", APP_USER_ID)
    .maybeSingle();
  if (yoni && !yoni.onshape_user_id) {
    const { error: bindErr } = await sb
      .from("users")
      .update({ onshape_user_id: onshapeId })
      .eq("id", APP_USER_ID);
    if (bindErr) throw new Error(`binding onshape user: ${bindErr.message}`);
    return { id: APP_USER_ID, created: false };
  }

  const { data: inserted, error: insertErr } = await sb
    .from("users")
    .insert({
      onshape_user_id: onshapeId,
      display_name: name,
      initials,
      avatar_color: DEFAULT_AVATAR,
    })
    .select("id")
    .single();
  if (insertErr || !inserted) throw new Error(`creating user: ${insertErr?.message ?? "no row"}`);
  return { id: inserted.id as string, created: true };
}
