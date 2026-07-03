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
  return (data || []).map(toAdminMessage);
}

export async function getMessageForAdmin(id) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("messages")
    .select("id,allow_public,is_public,likes,receipt_token")
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
      letters.push(toReplyLetter(data));
    }
  }

  return letters;
}
