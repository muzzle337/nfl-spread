const COOKIE_NAME = "nfl_admin_session";
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const encoder = new TextEncoder();

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = String(value).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(value).length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(String(value))));
}

function equalBytes(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pinMatches(provided, expected) {
  if (!provided || !expected) return false;
  const [a, b] = await Promise.all([sha256(provided), sha256(expected)]);
  return equalBytes(a, b);
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(String(value))));
}

function cookieValue(request) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME) return rest.join("=");
  }
  return null;
}

export async function createAdminSession(pin, env, now = Date.now()) {
  if (!env?.ADMIN_UI_PIN) return { ok: false, status: 503, error: "Admin UI PIN is not configured" };
  if (!env?.INGEST_ADMIN_TOKEN) return { ok: false, status: 503, error: "Admin ingest token is not configured" };
  if (!(await pinMatches(pin, env.ADMIN_UI_PIN))) return { ok: false, status: 401, error: "Incorrect PIN" };

  const payload = base64UrlEncode(encoder.encode(JSON.stringify({
    role: "admin",
    exp: Math.floor(now / 1000) + SESSION_SECONDS
  })));
  const signature = base64UrlEncode(await hmac(payload, env.INGEST_ADMIN_TOKEN));
  return {
    ok: true,
    token: `${payload}.${signature}`,
    expiresInSeconds: SESSION_SECONDS
  };
}

export async function isAdminSessionAuthorized(request, env, now = Date.now()) {
  const expectedAdminToken = env?.INGEST_ADMIN_TOKEN;
  if (!expectedAdminToken) return { ok: false, status: 503, error: "Admin ingest token is not configured" };

  const directToken = request.headers.get("x-admin-token");
  if (directToken && directToken === expectedAdminToken) return { ok: true, method: "admin-token" };

  const token = cookieValue(request);
  if (!token) return { ok: false, status: 401, error: "Admin PIN required" };
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return { ok: false, status: 401, error: "Admin session is invalid" };

  try {
    const expectedSignature = await hmac(payload, expectedAdminToken);
    if (!equalBytes(base64UrlDecode(signature), expectedSignature)) {
      return { ok: false, status: 401, error: "Admin session is invalid" };
    }
    const body = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload)));
    if (body?.role !== "admin" || !Number.isFinite(Number(body.exp)) || Number(body.exp) <= Math.floor(now / 1000)) {
      return { ok: false, status: 401, error: "Admin session has expired" };
    }
    return { ok: true, method: "session", expiresAt: new Date(Number(body.exp) * 1000).toISOString() };
  } catch {
    return { ok: false, status: 401, error: "Admin session is invalid" };
  }
}

export function adminSessionCookie(token, maxAge = SESSION_SECONDS) {
  return `${COOKIE_NAME}=${token}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminSessionCookie() {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}
