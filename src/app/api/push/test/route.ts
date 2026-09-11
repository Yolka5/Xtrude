import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { sendPushToUser } from "@/lib/push/send";
import { pushIsConfigured } from "@/lib/push/config";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    if (!pushIsConfigured()) {
      return NextResponse.json({ ok: true, sent: 0, unavailable: true });
    }
    const userId = await getCurrentUserId();
    const result = await sendPushToUser(userId, {
      title: "Xtrude",
      body: "Test notification — if you can read this, push is working.",
      url: "/",
      type: "streak",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ ok: true, sent: 0, unavailable: true });
  }
}
