import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, adminCookieOptions, adminPassword, makeSession } from "../../../../lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const data = await request.json();
    const password = String(data.password || "");
    const expected = adminPassword();

    if (
      password.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(password), Buffer.from(expected))
    ) {
      return NextResponse.json(
        { ok: false, error: "bad_password" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, makeSession(), adminCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: "login_failed" }, { status: 500 });
  }
}
