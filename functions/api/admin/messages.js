import { isAdminRequest } from "../../_lib/auth";
import { json } from "../../_lib/http";
import { listAdminMessages } from "../../_lib/messages";

export async function onRequestGet({ request, env }) {
  try {
    if (!(await isAdminRequest(env, request))) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    const messages = await listAdminMessages(env);
    return json({ ok: true, messages });
  } catch {
    return json({ ok: false, error: "admin_messages_unavailable" }, 500);
  }
}
