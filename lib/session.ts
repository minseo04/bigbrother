import {createHmac, timingSafeEqual} from "node:crypto";

const COOKIE = "bb_session";
const MONTH = 30 * 24 * 60 * 60;

export type AuthMethods = {local: boolean; github: boolean; password: boolean};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") throw new Error("Set AUTH_SECRET before signing anyone in.");
  return "dev-only-auth-secret";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cookie(name: string, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function authMethods(): AuthMethods {
  return {
    local: process.env.NODE_ENV !== "production" || process.env.AUTH_ALLOW_LOCAL === "1",
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    password: Boolean(process.env.AUTH_PASSWORD),
  };
}

export function encodeSession(id: string) {
  const payload = Buffer.from(JSON.stringify({id, exp: Date.now() + MONTH * 1000})).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function sessionCookie(id: string) {
  return cookie(COOKIE, encodeSession(id), MONTH);
}

export function clearSessionCookie() {
  return cookie(COOKIE, "", 0);
}

export function readCookie(header: string | null, name: string) {
  if (!header) return "";
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(name + "=")) return decodeURIComponent(trimmed.slice(name.length + 1));
  }
  return "";
}

export function sessionUser(request: Request): string | null {
  const token = readCookie(request.headers.get("cookie"), COOKIE);
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!safeEqual(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {id?: unknown; exp?: unknown};
    if (typeof data.id !== "string" || data.id.length < 1 || data.id.length > 200) return null;
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data.id;
  } catch {
    return null;
  }
}

export function oauthStateCookie(state: string) {
  return cookie("bb_oauth_state", state, 600);
}

export function readOAuthState(request: Request) {
  return readCookie(request.headers.get("cookie"), "bb_oauth_state");
}

export function clearOAuthStateCookie() {
  return cookie("bb_oauth_state", "", 0);
}

export function randomToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64url");
}

export function passwordMatches(candidate: string) {
  const expected = process.env.AUTH_PASSWORD;
  if (!expected) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
