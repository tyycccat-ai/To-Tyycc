import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  DEFAULT_STICKY_PASSWORD_HOURS,
  STICKY_PASSWORD_KEY,
  createStickyPasswordSetting,
  stickyPasswordExpired,
  stickyPasswordDurationHours
} from "./stickyAuth";

export const MAX_STICKY_CONTENT_LENGTH = 2000;
export const MAX_STICKY_LOCATION_LENGTH = 40;

export function normalizeStickyLocation(location) {
  const value = String(location || "").trim().slice(0, MAX_STICKY_LOCATION_LENGTH);
  if (!value) return { location: "", locationRegion: "" };
  return {
    location: value,
    locationRegion: value
  };
}

export function toStickyNote(row) {
  return {
    id: row.id,
    content: row.content || "",
    location: row.location || "",
    locationRegion: row.location_region || row.location || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

export async function listStickyNotes() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sticky_notes")
    .select("id,content,location,location_region,created_at,updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(toStickyNote);
}

export async function createStickyNote({ content, location }) {
  const normalized = normalizeStickyLocation(location);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sticky_notes")
    .insert({
      content,
      location: normalized.location || null,
      location_region: normalized.locationRegion || null
    })
    .select("id,content,location,location_region,created_at,updated_at")
    .single();
  if (error) throw error;
  return toStickyNote(data);
}

export async function updateStickyNote(id, { content, location }) {
  const updates = { updated_at: new Date().toISOString() };
  if (content != null) updates.content = content;
  if (location != null) {
    const normalized = normalizeStickyLocation(location);
    updates.location = normalized.location || null;
    updates.location_region = normalized.locationRegion || null;
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sticky_notes")
    .update(updates)
    .eq("id", id)
    .select("id,content,location,location_region,created_at,updated_at")
    .maybeSingle();
  if (error) throw error;
  return data ? toStickyNote(data) : null;
}

export async function deleteStickyNote(id) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("sticky_notes").delete().eq("id", id);
  if (error) throw error;
}

export async function getStickyPasswordSetting() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", STICKY_PASSWORD_KEY)
    .maybeSingle();
  if (error) throw error;
  return data?.value || null;
}

export async function saveStickyPasswordSetting(value) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("site_settings")
    .upsert(
      {
        key: STICKY_PASSWORD_KEY,
        value,
        updated_at: new Date().toISOString()
      },
      { onConflict: "key" }
    );
  if (error) throw error;
  return value;
}

export async function generateAndSaveStickyPassword(durationHours = DEFAULT_STICKY_PASSWORD_HOURS) {
  const setting = createStickyPasswordSetting(durationHours);
  await saveStickyPasswordSetting(setting);
  return setting;
}

export async function ensureStickyPasswordSetting({ createIfMissing = false } = {}) {
  const setting = await getStickyPasswordSetting();
  if (!setting) {
    if (!createIfMissing) return { setting: null, rotated: false };
    return {
      setting: await generateAndSaveStickyPassword(DEFAULT_STICKY_PASSWORD_HOURS),
      rotated: true
    };
  }
  if (!stickyPasswordExpired(setting)) {
    return { setting, rotated: false };
  }
  const durationHours = stickyPasswordDurationHours(setting.durationHours);
  return {
    setting: await generateAndSaveStickyPassword(durationHours),
    rotated: true
  };
}
