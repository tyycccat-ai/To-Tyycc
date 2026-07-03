import { json, readJson } from "../../_lib/http";
import { lookupReplyLetters } from "../../_lib/messages";

export async function onRequestPost({ request, env }) {
  try {
    const data = await readJson(request);
    if (!Array.isArray(data.receipts)) {
      return json({ ok: false, error: "bad_receipts" }, 400);
    }
    const letters = await lookupReplyLetters(env, data.receipts);
    return json({ ok: true, letters });
  } catch {
    return json({ ok: false, error: "reply_lookup_failed" }, 500);
  }
}
