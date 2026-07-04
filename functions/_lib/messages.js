import { supabaseRequest } from "./supabase";

export const MAX_CONTENT_LENGTH = 3000;
export const MAX_NICKNAME_LENGTH = 24;
export const MAX_REPLY_LENGTH = 3000;

const blockedTerms = [
  "http://",
  "https://",
  "www.",
  "加微信",
  "VX",
  "vx",
  "QQ",
  "赚钱",
  "贷款",
  "博彩",
  "赌场",
  "代开",
  "发票",
  "刷单",
  "色情"
];

export function contentBlocked(content, nickname) {
  const normalized = `${content}\n${nickname}`.toLowerCase();
  const compact = normalized.replace(/\s+/g, "");
  if (compact.length >= 20 && new Set(compact).size <= 2) return true;
  return blockedTerms.some((term) => normalized.includes(term.toLowerCase()));
}

function randomToken(bytes = 24) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  let value = "";
  for (const byte of data) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function displayName(message) {
  const nickname = String(message.nickname || "").trim();
  return message.allow_public && nickname ? nickname : "匿名";
}

export function toPublicMessage(message) {
  return {
    id: message.id,
    content: message.content || "",
    displayName: displayName(message),
    createdAt: message.created_at || "",
    reply: message.reply || "",
    likes: Number(message.likes || 0)
  };
}

export function toReplySupplement(supplement) {
  return {
    id: supplement.id,
    content: supplement.content || "",
    createdAt: supplement.created_at || supplement.createdAt || ""
  };
}

export function toAdminMessage(message) {
  return {
    id: message.id,
    content: message.content || "",
    nickname: message.nickname || "",
    allowPublic: Boolean(message.allow_public),
    isPublic: Boolean(message.is_public),
    createdAt: message.created_at || "",
    reply: message.reply || "",
    replySupplements: (message.replySupplements || []).map(toReplySupplement),
    likes: Number(message.likes || 0),
    displayName: displayName(message)
  };
}

export function toReplyLetter(message) {
  return {
    id: message.id,
    content: message.content || "",
    createdAt: message.created_at || "",
    reply: message.reply || "",
    replyUpdatedAt: message.reply_updated_at || "",
    replySupplements: (message.replySupplements || []).map(toReplySupplement)
  };
}

async function listSupplementsForMessages(env, messageIds) {
  if (!messageIds.length) return new Map();
  let rows = [];
  try {
    rows = await supabaseRequest(env, "GET", "reply_supplements", {
      query: {
        select: "id,message_id,content,created_at",
        message_id: `in.(${messageIds.join(",")})`,
        order: "created_at.asc"
      }
    });
  } catch (error) {
    if (/reply_supplements/i.test(error?.message || "")) return new Map();
    throw error;
  }

  const grouped = new Map();
  for (const supplement of rows || []) {
    const key = String(supplement.message_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(supplement);
  }
  return grouped;
}

async function listJsonSupplementsForMessages(env, messageIds) {
  if (!messageIds.length) return new Map();
  let rows = [];
  try {
    rows = await supabaseRequest(env, "GET", "messages", {
      query: {
        select: "id,reply_supplements",
        id: `in.(${messageIds.join(",")})`
      }
    });
  } catch (error) {
    if (/reply_supplements/i.test(error?.message || "")) return new Map();
    throw error;
  }

  const grouped = new Map();
  for (const message of rows || []) {
    const supplements = Array.isArray(message.reply_supplements)
      ? message.reply_supplements
      : [];
    grouped.set(String(message.id), supplements.map(toReplySupplement));
  }
  return grouped;
}

async function attachSupplements(env, messages) {
  const ids = (messages || []).map((message) => message.id);
  const grouped = await listSupplementsForMessages(env, ids);
  const jsonGrouped = await listJsonSupplementsForMessages(env, ids);
  return (messages || []).map((message) => ({
    ...message,
    replySupplements: [
      ...(jsonGrouped.get(String(message.id)) || []),
      ...(grouped.get(String(message.id)) || [])
    ].sort((first, second) => String(first.createdAt).localeCompare(String(second.createdAt)))
  }));
}

export async function createMessage(env, { content, nickname, allowPublic }) {
  const receiptToken = randomToken();
  const rows = await supabaseRequest(env, "POST", "messages", {
    body: {
      content,
      nickname: nickname || null,
      allow_public: allowPublic,
      is_public: false,
      receipt_token: receiptToken
    }
  });
  return { id: rows?.[0]?.id, receiptToken };
}

export async function listPublicMessages(env) {
  const rows = await supabaseRequest(env, "GET", "messages", {
    query: {
      select: "id,content,nickname,allow_public,created_at,reply,likes",
      is_public: "eq.true",
      order: "created_at.desc"
    }
  });
  return (rows || []).map(toPublicMessage);
}

export async function listAdminMessages(env) {
  const rows = await supabaseRequest(env, "GET", "messages", {
    query: {
      select: "id,content,nickname,allow_public,is_public,created_at,reply,likes",
      order: "created_at.desc"
    }
  });
  return (await attachSupplements(env, rows || [])).map(toAdminMessage);
}

export async function getMessageForAdmin(env, id) {
  const rows = await supabaseRequest(env, "GET", "messages", {
    query: {
        select: "id,allow_public,is_public,likes,receipt_token,reply",
      id: `eq.${id}`,
      limit: "1"
    }
  });
  return rows?.[0] || null;
}

export async function updateMessage(env, id, updates) {
  await supabaseRequest(env, "PATCH", "messages", {
    query: { id: `eq.${id}` },
    body: updates
  });
}

export async function deleteMessage(env, id) {
  await supabaseRequest(env, "DELETE", "messages", {
    query: { id: `eq.${id}` }
  });
}

export async function createReplySupplement(env, messageId, content) {
  const createdAt = new Date().toISOString();
  const supplementDraft = {
    id: crypto.randomUUID(),
    content,
    createdAt
  };
  let rows = [];
  try {
    rows = await supabaseRequest(env, "POST", "reply_supplements", {
      body: {
        message_id: messageId,
        content,
        created_at: createdAt
      }
    });
  } catch (error) {
    if (!/reply_supplements/i.test(error?.message || "")) throw error;
    const messages = await supabaseRequest(env, "GET", "messages", {
      query: {
        select: "reply_supplements",
        id: `eq.${messageId}`,
        limit: "1"
      }
    });
    const currentSupplements = Array.isArray(messages?.[0]?.reply_supplements)
      ? messages[0].reply_supplements
      : [];
    await updateMessage(env, messageId, {
      reply_supplements: [...currentSupplements, supplementDraft],
      reply_updated_at: createdAt
    });
    return supplementDraft;
  }
  await updateMessage(env, messageId, { reply_updated_at: createdAt });
  return toReplySupplement(rows?.[0] || {});
}

export async function likePublicMessage(env, id) {
  const message = await getMessageForAdmin(env, id);
  if (!message?.is_public) return null;
  const likes = Number(message.likes || 0) + 1;
  await updateMessage(env, id, { likes });
  return likes;
}

export async function lookupReplyLetters(env, receipts) {
  const validReceipts = receipts
    .slice(0, 50)
    .map((receipt) => ({
      id: String(receipt?.id || "").trim(),
      receiptToken: String(receipt?.receiptToken || "").trim()
    }))
    .filter((receipt) => receipt.id && receipt.receiptToken);

  const letters = [];

  for (const receipt of validReceipts) {
    const rows = await supabaseRequest(env, "GET", "messages", {
      query: {
        select: "id,content,created_at,reply,reply_updated_at,receipt_token",
        id: `eq.${receipt.id}`,
        receipt_token: `eq.${receipt.receiptToken}`,
        limit: "1"
      }
    });
    const message = rows?.[0];
    if (message?.reply?.trim()) {
      const [messageWithSupplements] = await attachSupplements(env, [message]);
      letters.push(toReplyLetter(messageWithSupplements));
    }
  }

  return letters;
}
