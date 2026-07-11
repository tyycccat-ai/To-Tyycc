import { clearStickySessionCookie } from "../../_lib/stickyAuth";
import { json } from "../../_lib/http";

export async function onRequestPost({ request }) {
  return json({ ok: true }, 200, {
    "set-cookie": clearStickySessionCookie(request)
  });
}
