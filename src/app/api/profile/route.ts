import { NextRequest, NextResponse } from "next/server";
import { updateUserDisplayName } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { displayName?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const result = await updateUserDisplayName(body.displayName ?? "");
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "failed" }, { status: 400 });
  }
}
