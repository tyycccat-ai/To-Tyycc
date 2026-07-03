import { json, readJson } from "../_lib/http";
import {
  MAX_CONTENT_LENGTH,
  MAX_NICKNAME_LENGTH,
  contentBlocked,
  createMessage
} from "../_lib/messages";
import { clientIp, rateLimited } from "../_lib/rateLimit";

export async function onRequestPost({ request, env }) {
  try {
    const data = await readJson(request);
    const content = String(data.content || "").trim();
    const nickname = String(data.nickname || "").trim();
    const allowPublic = Boolean(data.allowPublic);

    if (!content) return json({ ok: false, error: "content_required" }, 400);
    if (content.length > MAX_CONTENT_LENGTH) {
      return json({ ok: false, error: "too_long" }, 400);
    }
    if (nickname.length > MAX_NICKNAME_LENGTH) {
      return json({ ok: false, error: "nickname_too_long" }, 400);
    }
    if (contentBlocked(content, nickname)) {
      return json({ ok: false, error: "blocked_content" }, 400);
    }
    if (rateLimited(clientIp(request))) {
      return json({ ok: false, error: "rate_limited" }, 429);
    }

    const letter = await createMessage(env, { content, nickname, allowPublic });
    return json({ ok: true, letter }, 201);
  } catch {
    return json({ ok: false, error: "delivery_failed" }, 500);
  }
}
