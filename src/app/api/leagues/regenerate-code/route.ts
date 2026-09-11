import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { regenerateLeagueJoinCode } from "@/lib/db/leagues";

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
    const result = await regenerateLeagueJoinCode(await getCurrentUserId(), body.leagueId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 400 });
  }
}
