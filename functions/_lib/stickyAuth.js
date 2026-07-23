import { cookieHeader, parseCookies } from "./http";

export const STICKY_SESSION_COOKIE = "tot_sticky_session";
export const STICKY_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const STICKY_PASSWORD_KEY = "tot_sticky_password";
export const DEFAULT_STICKY_PASSWORD_HOURS = 24;
export const MIN_STICKY_PASSWORD_HOURS = 1;
export const MAX_STICKY_PASSWORD_HOURS = 168;

const HASH_ITERATIONS = 160000;
const HASH_KEY_LENGTH = 32;
const PASSWORD_ALPHABET = "0123456789";

function textBytes(value) {
  return new TextEncoder().encode(value);
}

function hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64Url(buffer) {
  let value = "";
  for (const byte of new Uint8Array(buffer)) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(bytes = 18) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64Url(data);
}

async function hmac(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    textBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, textBytes(payload)));
}

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    textBytes(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: textBytes(salt),
      iterations
    },
    key,
    HASH_KEY_LENGTH * 8
  );
  return base64Url(bits);
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function sessionSecret(env) {
  if (!env.TOT_SESSION_SECRET) throw new Error("Missing TOT_SESSION_SECRET.");
  return env.TOT_SESSION_SECRET;
}

export async function hashStickyPassword(password) {
  const salt = randomToken(16);
  return {
    salt,
    hash: await pbkdf2(password, salt, HASH_ITERATIONS),
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
  const data = new Uint8Array(4);
  crypto.getRandomValues(data);
  const chars = [...data].map((byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]);
  return chars.join("");
}

export async function createStickyPasswordSetting(
  durationHours = DEFAULT_STICKY_PASSWORD_HOURS,
  customPassword = ""
) {
  const password = String(customPassword || "").trim() || generateStickyPassword();
  const hours = stickyPasswordDurationHours(durationHours);
  const now = Date.now();
  return {
    ...(await hashStickyPassword(password)),
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

export async function verifyStickyPassword(password, setting) {
  if (!setting?.salt || !setting?.hash || !setting?.iterations) return false;
  const hash = await pbkdf2(password, setting.salt, Number(setting.iterations));
  return safeEqual(hash, setting.hash);
}

export async function makeStickySession(env, version) {
  const issued = String(Math.floor(Date.now() / 1000));
  const nonce = randomToken();
  const payload = `${issued}.${version}.${nonce}`;
  return `${payload}.${await hmac(sessionSecret(env), payload)}`;
}

export async function validStickySession(env, value, currentVersion) {
  if (!value || !currentVersion) return false;
  const pieces = value.split(".");
  if (pieces.length !== 4) return false;
  const [issued, version, nonce, signature] = pieces;
  if (version !== currentVersion) return false;
  const payload = `${issued}.${version}.${nonce}`;
  const expected = await hmac(sessionSecret(env), payload);
  const issuedAt = Number(issued);
  return (
    Number.isFinite(issuedAt) &&
    Date.now() / 1000 - issuedAt <= STICKY_SESSION_MAX_AGE &&
    safeEqual(signature, expected)
  );
}

export async function isStickyRequest(env, request, setting) {
  const cookies = parseCookies(request.headers.get("cookie"));
  return validStickySession(env, cookies[STICKY_SESSION_COOKIE], setting?.version);
}

export function stickySessionCookie(value, request) {
  return cookieHeader(STICKY_SESSION_COOKIE, value, {
    maxAge: STICKY_SESSION_MAX_AGE,
    secure: new URL(request.url).protocol === "https:"
  });
}

export function clearStickySessionCookie(request) {
  return cookieHeader(STICKY_SESSION_COOKIE, "", {
    maxAge: 0,
    secure: new URL(request.url).protocol === "https:"
  });
}
