import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../../lib/auth";
import {
  MAX_STICKY_CONTENT_LENGTH,
  MAX_STICKY_LOCATION_LENGTH,
  deleteStickyNote,
  updateStickyNote
} from "../../../../../lib/stickyNotes";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const { id } = await params;
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

    const note = await updateStickyNote(id, { content, location });
    if (!note) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, note });
  } catch {
    return NextResponse.json({ ok: false, error: "update_sticky_note_failed" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await deleteStickyNote(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "delete_sticky_note_failed" }, { status: 500 });
  }
}
