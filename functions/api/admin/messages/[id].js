import { isAdminRequest } from "../../../_lib/auth";
import { json, readJson } from "../../../_lib/http";
import {
  MAX_REPLY_LENGTH,
  createReplySupplement,
  deleteMessage,
  getMessageForAdmin,
  updateMessage
} from "../../../_lib/messages";

export async function onRequestPatch({ request, env, params }) {
  try {
    if (!(await isAdminRequest(env, request))) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const message = await getMessageForAdmin(env, params.id);
    if (!message) return json({ ok: false, error: "not_found" }, 404);

    const data = await readJson(request);
    const updates = {};

    if ("supplementReply" in data) {
      const supplementReply = String(data.supplementReply || "").trim();
      if (!message.reply?.trim()) {
        return json({ ok: false, error: "reply_required" }, 400);
      }
      if (!supplementReply) {
        return json({ ok: false, error: "supplement_required" }, 400);
      }
      if (supplementReply.length > MAX_REPLY_LENGTH) {
        return json({ ok: false, error: "supplement_too_long" }, 400);
      }
      const supplement = await createReplySupplement(env, params.id, supplementReply);
      return json({ ok: true, supplement });
    }

    if ("isPublic" in data) {
      const isPublic = Boolean(data.isPublic);
      if (isPublic && !message.allow_public) {
        return json({ ok: false, error: "public_not_allowed" }, 403);
      }
      updates.is_public = isPublic;
    }

    if ("reply" in data) {
      const reply = String(data.reply || "").trim();
      if (reply.length > MAX_REPLY_LENGTH) {
        return json({ ok: false, error: "reply_too_long" }, 400);
      }
      updates.reply = reply || null;
      updates.reply_updated_at = reply ? new Date().toISOString() : null;
    }

    if (!Object.keys(updates).length) {
      return json({ ok: false, error: "no_updates" }, 400);
    }

    await updateMessage(env, params.id, updates);
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "update_failed" }, 500);
  }
}

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!(await isAdminRequest(env, request))) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const message = await getMessageForAdmin(env, params.id);
    if (!message) return json({ ok: false, error: "not_found" }, 404);

    await deleteMessage(env, params.id);
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "delete_failed" }, 500);
  }
}
