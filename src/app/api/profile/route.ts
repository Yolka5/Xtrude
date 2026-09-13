import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/currentUser";
import { claimHandle } from "@/lib/db/handles";
import { updateUserDisplayName } from "@/lib/db/queries";
import { displayHandle } from "@/lib/profileFields";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  let body: { displayName?: string; handle?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    const result: { displayName?: string; initials?: string; handle?: string } = {};
    if (typeof body.displayName === "string") {
      const name = await updateUserDisplayName(body.displayName);
      result.displayName = name.displayName;
      result.initials = name.initials;
    }
    if (typeof body.handle === "string") {
      const claimed = await claimHandle(userId, body.handle);
      result.handle = displayHandle(claimed.handle);
    }
    if (!result.displayName && !result.handle) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed";
    const status = message === "unauthenticated" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
