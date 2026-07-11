import { isAdminRequest } from "../../_lib/auth";
import { json, readJson } from "../../_lib/http";
import {
  MAX_STICKY_CONTENT_LENGTH,
  MAX_STICKY_LOCATION_LENGTH,
  createStickyNote,
  ensureStickyPasswordSetting,
  listStickyNotes
} from "../../_lib/stickyNotes";

export async function onRequestGet({ request, env }) {
  try {
    if (!(await isAdminRequest(env, request))) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const [notes, passwordState] = await Promise.all([
      listStickyNotes(env),
      ensureStickyPasswordSetting(env)
    ]);
    const setting = passwordState.setting;
    return json({
      ok: true,
      notes,
      passwordSet: Boolean(setting?.version),
      currentPassword: setting?.plainPassword || "",
      expiresAt: setting?.expiresAt || "",
      durationHours: setting?.durationHours || 24,
      rotated: passwordState.rotated
    });
  } catch {
    return json({ ok: false, error: "sticky_notes_unavailable" }, 500);
  }
}

export async function onRequestPost({ request, env }) {
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
    const note = await createStickyNote(env, { content, location });
    return json({ ok: true, note }, 201);
  } catch {
    return json({ ok: false, error: "create_sticky_note_failed" }, 500);
  }
}
