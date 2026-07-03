import { createClient } from "@supabase/supabase-js";

let cachedClient;

export function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  if (!cachedClient) {
    cachedClient = createClient(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return cachedClient;
}
