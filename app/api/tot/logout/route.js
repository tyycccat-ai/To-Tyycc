import { NextResponse } from "next/server";
import {
  STICKY_SESSION_COOKIE,
  stickyCookieOptions
} from "../../../../lib/stickyAuth";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(STICKY_SESSION_COOKIE, "", stickyCookieOptions(0));
  return response;
}
