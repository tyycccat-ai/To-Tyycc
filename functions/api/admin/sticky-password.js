import { isAdminRequest } from "../../_lib/auth";
import { json, readJson } from "../../_lib/http";
import { stickyPasswordDurationHours } from "../../_lib/stickyAuth";
import { generateAndSaveStickyPassword } from "../../_lib/stickyNotes";

export async function onRequestPatch({ request, env }) {
  try {
    if (!(await isAdminRequest(env, request))) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const data = await readJson(request);
    const durationHours = stickyPasswordDurationHours(data.durationHours);
    const customPassword = String(data.password || "").trim().slice(0, 64);
    const setting = await generateAndSaveStickyPassword(env, durationHours, customPassword);
    return json({
      ok: true,
      passwordSet: true,
      currentPassword: setting.plainPassword,
      expiresAt: setting.expiresAt,
      durationHours: setting.durationHours
    });
  } catch {
    return json({ ok: false, error: "sticky_password_update_failed" }, 500);
  }
}
