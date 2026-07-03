import { adminPassword, makeSession, sessionCookie } from "../../_lib/auth";
import { json, readJson } from "../../_lib/http";

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function onRequestPost({ request, env }) {
  try {
    const data = await readJson(request);
    const password = String(data.password || "");
    const expected = adminPassword(env);

    if (!safeEqual(password, expected)) {
      return json({ ok: false, error: "bad_password" }, 401);
    }

    return json(
      { ok: true },
      200,
      { "set-cookie": sessionCookie(await makeSession(env), request) }
    );
  } catch {
    return json({ ok: false, error: "login_failed" }, 500);
  }
}
