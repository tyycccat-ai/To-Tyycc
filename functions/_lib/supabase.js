function supabaseUrl(env) {
  return (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
}

function serviceKey(env) {
  return env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export async function supabaseRequest(env, method, table, { query, body } = {}) {
  const url = supabaseUrl(env);
  const key = serviceKey(env);

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  const search = new URLSearchParams(query || {});
  const endpoint = `${url}/rest/v1/${table}${search.size ? `?${search}` : ""}`;
  const response = await fetch(endpoint, {
    method,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      accept: "application/json",
      ...(method === "POST" ? { prefer: "return=representation" } : {})
    },
    body: body == null ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
