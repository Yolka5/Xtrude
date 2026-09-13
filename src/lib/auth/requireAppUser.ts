import "server-only";
import { redirect } from "next/navigation";
import { getHandleForUser } from "@/lib/db/handles";
import { getSessionUserId } from "./currentUser";

/** Logged-in app pages: must have a session and a chosen @. */
export async function requireAppUser(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/connect/");
  const handle = await getHandleForUser(userId);
  if (!handle) redirect("/welcome/");
  return userId;
}
