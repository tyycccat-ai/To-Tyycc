const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 3;
const buckets = new Map();

export function clientIp(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() ||
    "unknown"
  );
}

export function rateLimited(ip) {
  const now = Date.now();
  const recent = (buckets.get(ip) || []).filter(
    (stamp) => now - stamp < RATE_LIMIT_WINDOW
  );

  if (recent.length >= RATE_LIMIT_MAX) {
    buckets.set(ip, recent);
    return true;
  }

  recent.push(now);
  buckets.set(ip, recent);
  return false;
}
