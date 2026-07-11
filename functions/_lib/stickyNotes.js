import { supabaseRequest } from "./supabase";
import {
  DEFAULT_STICKY_PASSWORD_HOURS,
  STICKY_PASSWORD_KEY,
  createStickyPasswordSetting,
  stickyPasswordDurationHours,
  stickyPasswordExpired
} from "./stickyAuth";

export const MAX_STICKY_CONTENT_LENGTH = 2000;
export const MAX_STICKY_LOCATION_LENGTH = 40;

export function normalizeStickyLocation(location) {
  const value = String(location || "").trim().slice(0, MAX_STICKY_LOCATION_LENGTH);
  if (!value) return { location: "", locationRegion: "" };
  return { location: value, locationRegion: value };
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

export async function listStickyNotes(env) {
  const rows = await supabaseRequest(env, "GET", "sticky_notes", {
    query: {
      select: "id,content,location,location_region,created_at,updated_at",
      order: "created_at.desc"
    }
  });
  return (rows || []).map(toStickyNote);
}

export async function createStickyNote(env, { content, location }) {
  const normalized = normalizeStickyLocation(location);
  const rows = await supabaseRequest(env, "POST", "sticky_notes", {
    body: {
      content,
      location: normalized.location || null,
      location_region: normalized.locationRegion || null
    }
  });
  return toStickyNote(rows?.[0] || {});
}

export async function updateStickyNote(env, id, { content, location }) {
  const updates = { updated_at: new Date().toISOString() };
  if (content != null) updates.content = content;
  if (location != null) {
    const normalized = normalizeStickyLocation(location);
    updates.location = normalized.location || null;
    updates.location_region = normalized.locationRegion || null;
  }
  await supabaseRequest(env, "PATCH", "sticky_notes", {
    query: { id: `eq.${id}` },
    body: updates
  });
  const rows = await supabaseRequest(env, "GET", "sticky_notes", {
    query: {
      select: "id,content,location,location_region,created_at,updated_at",
      id: `eq.${id}`,
      limit: "1"
    }
  });
  return rows?.[0] ? toStickyNote(rows[0]) : null;
}

export async function deleteStickyNote(env, id) {
  await supabaseRequest(env, "DELETE", "sticky_notes", {
    query: { id: `eq.${id}` }
  });
}

export async function getStickyPasswordSetting(env) {
  const rows = await supabaseRequest(env, "GET", "site_settings", {
    query: {
      select: "value",
      key: `eq.${STICKY_PASSWORD_KEY}`,
      limit: "1"
    }
  });
  return rows?.[0]?.value || null;
}

export async function saveStickyPasswordSetting(env, value) {
  const current = await getStickyPasswordSetting(env);
  if (current) {
    await supabaseRequest(env, "PATCH", "site_settings", {
      query: { key: `eq.${STICKY_PASSWORD_KEY}` },
      body: { value, updated_at: new Date().toISOString() }
    });
  } else {
    await supabaseRequest(env, "POST", "site_settings", {
      body: {
        key: STICKY_PASSWORD_KEY,
        value,
        updated_at: new Date().toISOString()
      }
    });
  }
  return value;
}

export async function generateAndSaveStickyPassword(
  env,
  durationHours = DEFAULT_STICKY_PASSWORD_HOURS
) {
  const setting = await createStickyPasswordSetting(durationHours);
  await saveStickyPasswordSetting(env, setting);
  return setting;
}

export async function ensureStickyPasswordSetting(env, { createIfMissing = false } = {}) {
  const setting = await getStickyPasswordSetting(env);
  if (!setting) {
    if (!createIfMissing) return { setting: null, rotated: false };
    return {
      setting: await generateAndSaveStickyPassword(env, DEFAULT_STICKY_PASSWORD_HOURS),
      rotated: true
    };
  }
  if (!stickyPasswordExpired(setting)) {
    return { setting, rotated: false };
  }
  const durationHours = stickyPasswordDurationHours(setting.durationHours);
  return {
    setting: await generateAndSaveStickyPassword(env, durationHours),
    rotated: true
  };
}
