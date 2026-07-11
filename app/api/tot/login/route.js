import { NextResponse } from "next/server";
import {
  STICKY_SESSION_COOKIE,
  makeStickySession,
  stickyCookieOptions,
  verifyStickyPassword
} from "../../../../lib/stickyAuth";
import { ensureStickyPasswordSetting } from "../../../../lib/stickyNotes";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { setting } = await ensureStickyPasswordSetting();
    if (!setting?.version) {
      return NextResponse.json({ ok: false, error: "password_unset" }, { status: 403 });
    }

    const data = await request.json();
    const password = String(data.password || "");
    if (!verifyStickyPassword(password, setting)) {
      return NextResponse.json({ ok: false, error: "bad_password" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      STICKY_SESSION_COOKIE,
      makeStickySession(setting.version),
      stickyCookieOptions()
    );
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "login_failed" }, { status: 500 });
  }
}
