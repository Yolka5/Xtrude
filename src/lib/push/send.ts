import "server-only";
import webpush from "web-push";
import { getSupabase } from "@/lib/db/client";
import { clientPushConfig, pushIsConfigured } from "./config";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  type?: "streak" | "league" | "badge";
};

function vapidConfigured(): boolean {
  if (!pushIsConfigured()) return false;
  try {
    const pub = process.env.PUSH_VAPID_PUBLIC_KEY!;
    const priv = process.env.PUSH_VAPID_PRIVATE_KEY!;
    webpush.setVapidDetails(process.env.PUSH_VAPID_SUBJECT || "mailto:xtrude@localhost", pub, priv);
    return true;
  } catch {
    return false;
  }
}

export function vapidPublicKey(): string | null {
  return clientPushConfig().publicKey;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; gone: number }> {
  if (!vapidConfigured()) return { sent: 0, gone: 0 };
  const { data, error } = await getSupabase()
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !data) return { sent: 0, gone: 0 };

  let sent = 0;
  let gone = 0;
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/",
    type: payload.type ?? "streak",
  });

  for (const row of data) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint as string,
          keys: { p256dh: row.p256dh as string, auth: row.auth as string },
        },
        body
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        gone++;
        await getSupabase().from("push_subscriptions").delete().eq("id", row.id);
      } else {
        console.error("push send failed:", err instanceof Error ? err.message : err);
      }
    }
  }
  return { sent, gone };
}
