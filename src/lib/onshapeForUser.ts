import "server-only";
import { makeClient } from "@/lib/onshapeRuntime";
import { getValidAccessToken, userNeedsReauth } from "@/lib/auth/tokens";
import { API_KEY_OWNER_ID } from "../../scripts/lib/appUser.mjs";

type Budget = { take: (method: string, path: string) => void; callsUsed: () => number };

export type UserOnshape =
  | { client: ReturnType<typeof makeClient>; via: "api_key" | "oauth" }
  | { client: null; reason: "needs_reauth" | "no_oauth_token" };

/**
 * An Onshape client that acts as this user and nobody else. The server's
 * API key pair is one Onshape account's credentials, so it is only used
 * for the Xtrude user who owns it; everyone else goes through their own
 * OAuth token. No usable token means no client - never someone else's.
 */
export async function onshapeClientForUser(userId: string, budget: Budget): Promise<UserOnshape> {
  const accessKey = process.env.ONSHAPE_ACCESS_KEY;
  const secretKey = process.env.ONSHAPE_SECRET_KEY;
  if (userId === API_KEY_OWNER_ID && accessKey && secretKey) {
    return { client: makeClient({ accessKey, secretKey, budget }), via: "api_key" };
  }
  if (await userNeedsReauth(userId)) return { client: null, reason: "needs_reauth" };
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return { client: null, reason: "no_oauth_token" };
  return { client: makeClient({ accessToken, budget }), via: "oauth" };
}
