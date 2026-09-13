import "server-only";
import { redirect } from "next/navigation";
import { ensureHandleForUser } from "@/lib/db/handles";
import { getSessionUserId } from "./currentUser";

/** Logged-in app pages: must have a session and an @ of their own. */
export async function requireAppUser(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/connect/");
  const handle = await ensureHandleForUser(userId);
  if (!handle) redirect("/welcome/");
  return userId;
}
