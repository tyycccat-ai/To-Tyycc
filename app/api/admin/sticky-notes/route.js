import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../lib/auth";
import {
  MAX_STICKY_CONTENT_LENGTH,
  MAX_STICKY_LOCATION_LENGTH,
  createStickyNote,
  ensureStickyPasswordSetting,
  listStickyNotes
} from "../../../../lib/stickyNotes";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const [notes, passwordState] = await Promise.all([
      listStickyNotes(),
      ensureStickyPasswordSetting()
    ]);
    const setting = passwordState.setting;
    return NextResponse.json({
      ok: true,
      notes,
      passwordSet: Boolean(setting?.version),
      currentPassword: setting?.plainPassword || "",
      expiresAt: setting?.expiresAt || "",
      durationHours: setting?.durationHours || 24,
      rotated: passwordState.rotated
    });
  } catch {
    return NextResponse.json({ ok: false, error: "sticky_notes_unavailable" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const content = String(data.content || "").trim();
    const location = String(data.location || "").trim();
    if (!content) {
      return NextResponse.json({ ok: false, error: "content_required" }, { status: 400 });
    }
    if (content.length > MAX_STICKY_CONTENT_LENGTH) {
      return NextResponse.json({ ok: false, error: "content_too_long" }, { status: 400 });
    }
    if (location.length > MAX_STICKY_LOCATION_LENGTH) {
      return NextResponse.json({ ok: false, error: "location_too_long" }, { status: 400 });
    }

    const note = await createStickyNote({ content, location });
    return NextResponse.json({ ok: true, note }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, error: "create_sticky_note_failed" }, { status: 500 });
  }
}
