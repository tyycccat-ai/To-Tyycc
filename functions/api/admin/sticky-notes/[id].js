import { isAdminRequest } from "../../../_lib/auth";
import { json, readJson } from "../../../_lib/http";
import {
  MAX_STICKY_CONTENT_LENGTH,
  MAX_STICKY_LOCATION_LENGTH,
  deleteStickyNote,
  updateStickyNote
} from "../../../_lib/stickyNotes";

export async function onRequestPatch({ request, env, params }) {
  try {
    if (!(await isAdminRequest(env, request))) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const data = await readJson(request);
    const content = String(data.content || "").trim();
    const location = String(data.location || "").trim();
    if (!content) return json({ ok: false, error: "content_required" }, 400);
    if (content.length > MAX_STICKY_CONTENT_LENGTH) {
      return json({ ok: false, error: "content_too_long" }, 400);
    }
    if (location.length > MAX_STICKY_LOCATION_LENGTH) {
      return json({ ok: false, error: "location_too_long" }, 400);
    }
    const note = await updateStickyNote(env, params.id, { content, location });
    if (!note) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true, note });
  } catch {
    return json({ ok: false, error: "update_sticky_note_failed" }, 500);
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!(await isAdminRequest(env, request))) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    await deleteStickyNote(env, params.id);
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "delete_sticky_note_failed" }, 500);
  }
}
