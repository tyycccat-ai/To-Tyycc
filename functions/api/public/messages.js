import { json } from "../../_lib/http";
import { listPublicMessages } from "../../_lib/messages";

export async function onRequestGet({ env }) {
  try {
    const messages = await listPublicMessages(env);
    return json({ ok: true, messages });
  } catch {
    return json({ ok: false, error: "public_messages_unavailable" }, 500);
  }
}
