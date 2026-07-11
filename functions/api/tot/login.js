import {
  makeStickySession,
  stickySessionCookie,
  verifyStickyPassword
} from "../../_lib/stickyAuth";
import { ensureStickyPasswordSetting } from "../../_lib/stickyNotes";
import { json, readJson } from "../../_lib/http";

export async function onRequestPost({ request, env }) {
  try {
    const { setting } = await ensureStickyPasswordSetting(env);
    if (!setting?.version) return json({ ok: false, error: "password_unset" }, 403);

    const data = await readJson(request);
    const password = String(data.password || "");
    if (!(await verifyStickyPassword(password, setting))) {
      return json({ ok: false, error: "bad_password" }, 401);
    }

    return json(
      { ok: true },
      200,
      { "set-cookie": stickySessionCookie(await makeStickySession(env, setting.version), request) }
    );
  } catch {
    return json({ ok: false, error: "login_failed" }, 500);
  }
}
