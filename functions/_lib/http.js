export function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (!key || !rest.length) continue;
    cookies[key] = rest.join("=");
  }

  return cookies;
}

export function cookieHeader(name, value, options = {}) {
  const pieces = [`${name}=${value}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (options.secure) pieces.push("Secure");
  if (Number.isFinite(options.maxAge)) pieces.push(`Max-Age=${options.maxAge}`);
  return pieces.join("; ");
}
