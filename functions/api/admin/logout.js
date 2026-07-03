import { clearSessionCookie } from "../../_lib/auth";
import { json } from "../../_lib/http";

export async function onRequestPost({ request }) {
  return json(
    { ok: true },
    200,
    { "set-cookie": clearSessionCookie(request) }
  );
}
