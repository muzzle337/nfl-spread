import test from "node:test";
import assert from "node:assert/strict";
import {
  adminSessionCookie,
  createAdminSession,
  isAdminSessionAuthorized
} from "../src/admin-session.js";
import { withAdminPinUi } from "../src/admin-pin-ui.js";

const env = {
  ADMIN_UI_PIN: "4827",
  INGEST_ADMIN_TOKEN: "server-side-admin-secret"
};

function requestWithCookie(cookie) {
  return new Request("https://example.com/api/admin/session", {
    headers: { cookie }
  });
}

test("correct PIN creates a signed 30-day admin session", async () => {
  const now = Date.UTC(2026, 8, 7, 20, 0, 0);
  const created = await createAdminSession("4827", env, now);
  assert.equal(created.ok, true);
  assert.equal(created.expiresInSeconds, 30 * 24 * 60 * 60);
  assert.ok(created.token.includes("."));

  const cookie = adminSessionCookie(created.token);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);

  const auth = await isAdminSessionAuthorized(requestWithCookie(cookie.split(";")[0]), env, now + 1000);
  assert.equal(auth.ok, true);
  assert.equal(auth.method, "session");
});

test("wrong PIN is rejected without issuing a session", async () => {
  const created = await createAdminSession("0000", env);
  assert.equal(created.ok, false);
  assert.equal(created.status, 401);
  assert.equal(created.error, "Incorrect PIN");
});

test("expired or tampered session cookies are rejected", async () => {
  const now = Date.UTC(2026, 8, 7, 20, 0, 0);
  const created = await createAdminSession("4827", env, now);
  const expired = await isAdminSessionAuthorized(
    requestWithCookie(`nfl_admin_session=${created.token}`),
    env,
    now + (31 * 24 * 60 * 60 * 1000)
  );
  assert.equal(expired.ok, false);

  const tamperedToken = `${created.token.slice(0, -1)}${created.token.endsWith("A") ? "B" : "A"}`;
  const tampered = await isAdminSessionAuthorized(
    requestWithCookie(`nfl_admin_session=${tamperedToken}`),
    env,
    now + 1000
  );
  assert.equal(tampered.ok, false);
});

test("existing direct admin token remains valid for compatibility", async () => {
  const request = new Request("https://example.com/api/ingest/nfl", {
    headers: { "x-admin-token": env.INGEST_ADMIN_TOKEN }
  });
  const auth = await isAdminSessionAuthorized(request, env);
  assert.equal(auth.ok, true);
  assert.equal(auth.method, "admin-token");
});

test("PIN UI removes browser admin-token storage and uses the session endpoint", () => {
  const html = withAdminPinUi('<html><body><div id="app"><section class="section"><input id="adminKey" class="admin-key"></section></div></body></html>');
  assert.match(html, /Admin Tools Locked/);
  assert.match(html, /\/api\/admin\/session/);
  assert.match(html, /HttpOnly|real admin key stays in Cloudflare/);
  assert.doesNotMatch(html, /nflSpreadAdminToken/);
  assert.doesNotMatch(html, /sessionStorage\.setItem/);
});
