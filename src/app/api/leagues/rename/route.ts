import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { renameLeague } from "@/lib/db/leagues";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { leagueId?: string; name?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.leagueId) return NextResponse.json({ error: "leagueId required" }, { status: 400 });
  try {
    const result = await renameLeague(await getCurrentUserId(), body.leagueId, body.name ?? "");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 400 });
  }
}
