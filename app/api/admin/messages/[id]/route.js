import { NextResponse } from "next/server";
import { isAdminRequest } from "../../../../../lib/auth";
import {
  MAX_REPLY_LENGTH,
  deleteMessage,
  getMessageForAdmin,
  updateMessage
} from "../../../../../lib/messages";

export async function PATCH(request, { params }) {
  try {
    if (!isAdminRequest(request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const message = await getMessageForAdmin(params.id);
    if (!message) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const data = await request.json();
    const updates = {};

    if ("isPublic" in data) {
      const isPublic = Boolean(data.isPublic);
      if (isPublic && !message.allow_public) {
        return NextResponse.json(
          { ok: false, error: "public_not_allowed" },
          { status: 403 }
        );
      }
      updates.is_public = isPublic;
    }

    if ("reply" in data) {
      const reply = String(data.reply || "").trim();
      if (reply.length > MAX_REPLY_LENGTH) {
        return NextResponse.json(
          { ok: false, error: "reply_too_long" },
          { status: 400 }
        );
      }
      updates.reply = reply || null;
      updates.reply_updated_at = reply ? new Date().toISOString() : null;
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ ok: false, error: "no_updates" }, { status: 400 });
    }

    await updateMessage(params.id, updates);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    if (!isAdminRequest(_request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const message = await getMessageForAdmin(params.id);
    if (!message) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    await deleteMessage(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 500 });
  }
}
