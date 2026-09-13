import "server-only";
import { getSupabase } from "@/lib/db/client";
import { planOnshapeLogin, type BoundUser } from "./bindUser";
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

  const { data: rows, error: existingErr } = await sb
    .from("users")
    .select("id, onshape_user_id");
  if (existingErr) throw new Error(`looking up user: ${existingErr.message}`);

  const users = (rows ?? []) as BoundUser[];
  const plan = planOnshapeLogin(onshapeId, users);
  if (plan.action === "reuse") {
    const { error: updateErr } = await sb
      .from("users")
      .update({ display_name: name, initials })
      .eq("id", plan.userId);
    if (updateErr) throw new Error(`updating user: ${updateErr.message}`);
    return { id: plan.userId, created: false };
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
