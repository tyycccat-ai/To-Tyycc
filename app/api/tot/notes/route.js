import { NextResponse } from "next/server";
import {
  STICKY_SESSION_COOKIE,
  validStickySession
} from "../../../../lib/stickyAuth";
import {
  ensureStickyPasswordSetting,
  listStickyNotes
} from "../../../../lib/stickyNotes";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { setting } = await ensureStickyPasswordSetting();
    if (!setting?.version) {
      return NextResponse.json({ ok: false, error: "password_unset" }, { status: 403 });
    }
    if (!validStickySession(request.cookies.get(STICKY_SESSION_COOKIE)?.value, setting.version)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const notes = await listStickyNotes();
    return NextResponse.json({ ok: true, notes });
  } catch {
    return NextResponse.json({ ok: false, error: "sticky_notes_unavailable" }, { status: 500 });
  }
}
