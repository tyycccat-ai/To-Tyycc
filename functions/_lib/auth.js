import { cookieHeader, parseCookies } from "./http";

export const SESSION_COOKIE = "tot_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 12;

function textBytes(value) {
  return new TextEncoder().encode(value);
}

function hex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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

function randomToken(bytes = 24) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  let value = "";
  for (const byte of data) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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

export function adminPassword(env) {
  if (!env.TOT_ADMIN_PASSWORD) throw new Error("Missing TOT_ADMIN_PASSWORD.");
  return env.TOT_ADMIN_PASSWORD;
}

export async function makeSession(env) {
  const issued = String(Math.floor(Date.now() / 1000));
  const nonce = randomToken();
  const payload = `${issued}.${nonce}`;
  return `${payload}.${await hmac(sessionSecret(env), payload)}`;
}

export async function validSession(env, value) {
  if (!value) return false;
  const pieces = value.split(".");
  if (pieces.length !== 3) return false;

  const [issued, nonce, signature] = pieces;
  const payload = `${issued}.${nonce}`;
  const expected = await hmac(sessionSecret(env), payload);
  const issuedAt = Number(issued);

  return (
    Number.isFinite(issuedAt) &&
    Date.now() / 1000 - issuedAt <= SESSION_MAX_AGE &&
    safeEqual(signature, expected)
  );
}

export async function isAdminRequest(env, request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  return validSession(env, cookies[SESSION_COOKIE]);
}

export function sessionCookie(value, request) {
  return cookieHeader(SESSION_COOKIE, value, {
    maxAge: SESSION_MAX_AGE,
    secure: new URL(request.url).protocol === "https:"
  });
}

export function clearSessionCookie(request) {
  return cookieHeader(SESSION_COOKIE, "", {
    maxAge: 0,
    secure: new URL(request.url).protocol === "https:"
  });
}
