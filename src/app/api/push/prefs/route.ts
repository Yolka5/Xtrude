import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { getSupabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getCurrentUserId();
  const { data, error } = await getSupabase()
    .from("users")
    .select("notify_streak, notify_league")
    .eq("id", userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({
    streak: data?.notify_streak !== false,
    league: data?.notify_league !== false,
  });
}

export async function POST(req: NextRequest) {
  let body: { streak?: boolean; league?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const userId = await getCurrentUserId();
  const patch: { notify_streak?: boolean; notify_league?: boolean } = {};
  if (typeof body.streak === "boolean") patch.notify_streak = body.streak;
  if (typeof body.league === "boolean") patch.notify_league = body.league;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  const { error } = await getSupabase().from("users").update(patch).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
