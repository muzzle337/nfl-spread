import test from "node:test";
import assert from "node:assert/strict";
import { adminIngestPage, isAdminAuthorized } from "../src/admin.js";

test("admin ingest rejects requests when token secret is not configured", () => {
  const request = new Request("https://example.com/api/ingest/nfl", {
    method: "POST",
    headers: { "x-admin-token": "anything" }
  });

  assert.deepEqual(isAdminAuthorized(request, {}), {
    ok: false,
    status: 503,
    error: "Admin ingest token is not configured"
  });
});

test("admin ingest rejects an incorrect token", () => {
  const request = new Request("https://example.com/api/ingest/nfl", {
    method: "POST",
    headers: { "x-admin-token": "wrong" }
  });

  assert.deepEqual(isAdminAuthorized(request, { INGEST_ADMIN_TOKEN: "correct" }), {
    ok: false,
    status: 401,
    error: "Unauthorized"
  });
});

test("admin ingest accepts the configured token", () => {
  const request = new Request("https://example.com/api/ingest/nfl/results", {
    method: "POST",
    headers: { "x-admin-token": "correct" }
  });

  assert.deepEqual(isAdminAuthorized(request, { INGEST_ADMIN_TOKEN: "correct" }), { ok: true });
});

test("admin page uses protected POST actions, explains guarded automatic sync, and never embeds an admin token", () => {
  const page = adminIngestPage();
  assert.match(page, /method:\s*'POST'/);
  assert.match(page, /x-admin-token/);
  assert.match(page, /\/api\/ingest\/nfl'/);
  assert.match(page, /\/api\/ingest\/nfl\/results'/);
  assert.match(page, /Check final scores/);
  assert.match(page, /automatically every day at 12:15 UTC/);
  assert.match(page, /0 Odds API credits/);
  assert.match(page, /2 credits/);
  assert.doesNotMatch(page, /INGEST_ADMIN_TOKEN/);
});
