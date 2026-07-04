import crypto from "node:crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

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
  if (compact.length >= 20 && new Set(compact).size <= 2) {
    return true;
  }
  return blockedTerms.some((term) => normalized.includes(term.toLowerCase()));
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
    createdAt: supplement.created_at || ""
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

async function listSupplementsForMessages(messageIds) {
  if (!messageIds.length) return new Map();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("reply_supplements")
    .select("id,message_id,content,created_at")
    .in("message_id", messageIds)
    .order("created_at", { ascending: true });

  if (error) {
    if (error.code === "42P01" || /reply_supplements/i.test(error.message || "")) {
      return new Map();
    }
    throw error;
  }

  const grouped = new Map();
  for (const supplement of data || []) {
    const key = String(supplement.message_id);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(supplement);
  }
  return grouped;
}

async function attachSupplements(messages) {
  const grouped = await listSupplementsForMessages((messages || []).map((message) => message.id));
  return (messages || []).map((message) => ({
    ...message,
    replySupplements: grouped.get(String(message.id)) || []
  }));
}

export async function createMessage({ content, nickname, allowPublic }) {
  const receiptToken = crypto.randomBytes(24).toString("base64url");
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      content,
      nickname: nickname || null,
      allow_public: allowPublic,
      is_public: false,
      receipt_token: receiptToken
    })
    .select("id")
    .single();

  if (error) throw error;
  return { id: data.id, receiptToken };
}

export async function listPublicMessages() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("id,content,nickname,allow_public,created_at,reply,likes")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(toPublicMessage);
}

export async function listAdminMessages() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("id,content,nickname,allow_public,is_public,created_at,reply,likes")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (await attachSupplements(data || [])).map(toAdminMessage);
}

export async function getMessageForAdmin(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("id,allow_public,is_public,likes,receipt_token,reply")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function updateMessage(id, updates) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("messages").update(updates).eq("id", id);
  if (error) throw error;
}

export async function deleteMessage(id) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("messages").delete().eq("id", id);
  if (error) throw error;
}

export async function createReplySupplement(messageId, content) {
  const supabase = getSupabaseAdmin();
  const createdAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("reply_supplements")
    .insert({
      message_id: messageId,
      content,
      created_at: createdAt
    })
    .select("id,content,created_at")
    .single();

  if (error) throw error;
  const { error: updateError } = await supabase
    .from("messages")
    .update({ reply_updated_at: createdAt })
    .eq("id", messageId);
  if (updateError) throw updateError;
  return toReplySupplement(data);
}

export async function likePublicMessage(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("id,is_public,likes")
    .eq("id", id)
    .single();

  if (error || !data?.is_public) return null;

  const likes = Number(data.likes || 0) + 1;
  const { error: updateError } = await supabase
    .from("messages")
    .update({ likes })
    .eq("id", id);

  if (updateError) throw updateError;
  return likes;
}

export async function lookupReplyLetters(receipts) {
  const validReceipts = receipts
    .slice(0, 50)
    .map((receipt) => ({
      id: String(receipt?.id || "").trim(),
      receiptToken: String(receipt?.receiptToken || "").trim()
    }))
    .filter((receipt) => receipt.id && receipt.receiptToken);

  if (!validReceipts.length) return [];

  const supabase = getSupabaseAdmin();
  const letters = [];

  for (const receipt of validReceipts) {
    const { data, error } = await supabase
      .from("messages")
      .select("id,content,created_at,reply,reply_updated_at,receipt_token")
      .eq("id", receipt.id)
      .eq("receipt_token", receipt.receiptToken)
      .maybeSingle();

    if (error) throw error;
    if (data?.reply?.trim()) {
      const [messageWithSupplements] = await attachSupplements([data]);
      letters.push(toReplyLetter(messageWithSupplements));
    }
  }

  return letters;
}
