import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/push/send";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const key = vapidPublicKey();
    if (!key) return NextResponse.json({ error: "push is not configured" }, { status: 503 });
    return NextResponse.json({ publicKey: key });
  } catch {
    return NextResponse.json({ error: "push is not configured" }, { status: 503 });
  }
}
