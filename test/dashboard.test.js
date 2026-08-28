import test from "node:test";
import assert from "node:assert/strict";
import { dashboardPage } from "../src/dashboard.js";

test("dashboard includes the agreed mobile navigation and focus sections", () => {
  const page = dashboardPage();
  assert.match(page, /NFL SPREAD TOOL/);
  assert.match(page, /Dashboard/);
  assert.match(page, /Games/);
  assert.match(page, /Focus/);
  assert.match(page, /Tools/);
  assert.match(page, /Building the 2026 sample/);
});

test("dashboard includes team-logo rendering and game detail sportsbook lines", () => {
  const page = dashboardPage();
  assert.match(page, /a\.espncdn\.com\/i\/teamlogos\/nfl\/500/);
  assert.match(page, /Sportsbook Lines/);
  assert.match(page, /Market Range/);
  assert.match(page, /Projected · Current Season/);
});

test("dashboard tools use existing protected endpoints without embedding a secret", () => {
  const page = dashboardPage();
  assert.match(page, /\/api\/ingest\/nfl/);
  assert.match(page, /\/api\/ingest\/nfl\/results/);
  assert.match(page, /\/api\/results\/integrity/);
  assert.match(page, /\/api\/usage/);
  assert.match(page, /x-admin-token/);
  assert.doesNotMatch(page, /INGEST_ADMIN_TOKEN/);
});

test("dashboard loads its current week from the dedicated D1-backed endpoint", () => {
  const page = dashboardPage();
  assert.match(page, /\/api\/dashboard\/nfl/);
  assert.doesNotMatch(page, /season=2026&week=1/);
});
