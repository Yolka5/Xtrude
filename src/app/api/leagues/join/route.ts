import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/currentUser";
import { joinLeagueByCode } from "@/lib/db/leagues";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { code?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const result = await joinLeagueByCode(await getCurrentUserId(), body.code ?? "");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 400 });
  }
}
