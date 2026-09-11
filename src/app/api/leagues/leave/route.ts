import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { leaveLeague } from "@/lib/db/leagues";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { leagueId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.leagueId) return NextResponse.json({ error: "leagueId required" }, { status: 400 });
  try {
    await leaveLeague(await getCurrentUserId(), body.leagueId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 400 });
  }
}
