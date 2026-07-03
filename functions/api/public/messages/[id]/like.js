import { json } from "../../../../_lib/http";
import { likePublicMessage } from "../../../../_lib/messages";

export async function onRequestPost({ env, params }) {
  try {
    const likes = await likePublicMessage(env, params.id);
    if (likes === null) return json({ ok: false, error: "not_found" }, 404);
    return json({ ok: true, likes });
  } catch {
    return json({ ok: false, error: "like_failed" }, 500);
  }
}
