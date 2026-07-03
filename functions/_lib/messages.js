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

export function toAdminMessage(message) {
  return {
    id: message.id,
    content: message.content || "",
    nickname: message.nickname || "",
    allowPublic: Boolean(message.allow_public),
    isPublic: Boolean(message.is_public),
    createdAt: message.created_at || "",
    reply: message.reply || "",
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
    replyUpdatedAt: message.reply_updated_at || ""
  };
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
  return (rows || []).map(toAdminMessage);
}

export async function getMessageForAdmin(env, id) {
  const rows = await supabaseRequest(env, "GET", "messages", {
    query: {
      select: "id,allow_public,is_public,likes,receipt_token",
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
    if (message?.reply?.trim()) letters.push(toReplyLetter(message));
  }

  return letters;
}
