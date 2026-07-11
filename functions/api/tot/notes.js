import { isStickyRequest } from "../../_lib/stickyAuth";
import { ensureStickyPasswordSetting, listStickyNotes } from "../../_lib/stickyNotes";
import { json } from "../../_lib/http";

export async function onRequestGet({ request, env }) {
  try {
    const { setting } = await ensureStickyPasswordSetting(env);
    if (!setting?.version) return json({ ok: false, error: "password_unset" }, 403);
    if (!(await isStickyRequest(env, request, setting))) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const notes = await listStickyNotes(env);
    return json({ ok: true, notes });
  } catch {
    return json({ ok: false, error: "sticky_notes_unavailable" }, 500);
  }
}
