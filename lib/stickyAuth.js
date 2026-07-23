import crypto from "node:crypto";

export const STICKY_SESSION_COOKIE = "tot_sticky_session";
export const STICKY_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const STICKY_PASSWORD_KEY = "tot_sticky_password";
export const DEFAULT_STICKY_PASSWORD_HOURS = 24;
export const MIN_STICKY_PASSWORD_HOURS = 1;
export const MAX_STICKY_PASSWORD_HOURS = 168;

const HASH_ITERATIONS = 160000;
const HASH_KEY_LENGTH = 32;
const PASSWORD_ALPHABET = "0123456789";

function sessionSecret() {
  const secret = process.env.TOT_SESSION_SECRET || "";
  if (!secret) throw new Error("Missing TOT_SESSION_SECRET.");
  return secret;
}

function sign(payload) {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function hashStickyPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, "sha256")
    .toString("base64url");
  return {
    salt,
    hash,
    iterations: HASH_ITERATIONS,
    version: crypto.randomUUID()
  };
}

export function stickyPasswordDurationHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return DEFAULT_STICKY_PASSWORD_HOURS;
  return Math.min(
    MAX_STICKY_PASSWORD_HOURS,
    Math.max(MIN_STICKY_PASSWORD_HOURS, Math.round(hours))
  );
}

export function generateStickyPassword() {
  const bytes = crypto.randomBytes(6);
  const chars = [...bytes].map((byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]);
  return chars.join("");
}

export function createStickyPasswordSetting(
  durationHours = DEFAULT_STICKY_PASSWORD_HOURS,
  customPassword = ""
) {
  const password = String(customPassword || "").trim() || generateStickyPassword();
  const hours = stickyPasswordDurationHours(durationHours);
  const now = Date.now();
  return {
    ...hashStickyPassword(password),
    plainPassword: password,
    durationHours: hours,
    generatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + hours * 60 * 60 * 1000).toISOString()
  };
}

export function stickyPasswordExpired(setting) {
  if (!setting?.plainPassword || !setting?.expiresAt) return true;
  const expiresAt = new Date(setting.expiresAt).getTime();
  return Number.isFinite(expiresAt) && Date.now() >= expiresAt;
}

export function verifyStickyPassword(password, setting) {
  if (!setting?.salt || !setting?.hash || !setting?.iterations) return false;
  const hash = crypto
    .pbkdf2Sync(
      password,
      setting.salt,
      Number(setting.iterations),
      HASH_KEY_LENGTH,
      "sha256"
    )
    .toString("base64url");
  return safeEqual(hash, setting.hash);
}

export function makeStickySession(version) {
  const issued = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(18).toString("base64url");
  const payload = `${issued}.${version}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function validStickySession(value, currentVersion) {
  if (!value || !currentVersion) return false;
  const pieces = value.split(".");
  if (pieces.length !== 4) return false;
  const [issued, version, nonce, signature] = pieces;
  if (version !== currentVersion) return false;
  const payload = `${issued}.${version}.${nonce}`;
  const expected = sign(payload);
  if (!safeEqual(signature, expected)) return false;

  const issuedAt = Number(issued);
  return (
    Number.isFinite(issuedAt) &&
    Date.now() / 1000 - issuedAt <= STICKY_SESSION_MAX_AGE
  );
}

export function stickyCookieOptions(maxAge = STICKY_SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  };
}
