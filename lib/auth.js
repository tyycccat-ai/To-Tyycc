import crypto from "node:crypto";

export const SESSION_COOKIE = "tot_admin_session";
const SESSION_MAX_AGE = 60 * 60 * 12;

function sessionSecret() {
  const secret = process.env.TOT_SESSION_SECRET || "";
  if (!secret) throw new Error("Missing TOT_SESSION_SECRET.");
  return secret;
}

export function adminPassword() {
  const password = process.env.TOT_ADMIN_PASSWORD || "";
  if (!password) throw new Error("Missing TOT_ADMIN_PASSWORD.");
  return password;
}

export function makeSession() {
  const issued = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(24).toString("base64url");
  const payload = `${issued}.${nonce}`;
  const signature = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

export function validSession(value) {
  if (!value) return false;
  const pieces = value.split(".");
  if (pieces.length !== 3) return false;
  const [issued, nonce, signature] = pieces;
  const payload = `${issued}.${nonce}`;
  const expected = crypto
    .createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("hex");

  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return false;
  }

  const issuedAt = Number(issued);
  return Number.isFinite(issuedAt) && Date.now() / 1000 - issuedAt <= SESSION_MAX_AGE;
}

export function isAdminRequest(request) {
  return validSession(request.cookies.get(SESSION_COOKIE)?.value);
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE
  };
}
