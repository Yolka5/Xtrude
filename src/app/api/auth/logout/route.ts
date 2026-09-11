import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function clearAndRedirect(req: NextRequest) {
  const dest = new URL("/connect/", req.nextUrl.origin);
  const res = NextResponse.redirect(dest);
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  return clearAndRedirect(req);
}

export async function POST(req: NextRequest) {
  return clearAndRedirect(req);
}
