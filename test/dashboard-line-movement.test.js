import test from "node:test";
import assert from "node:assert/strict";
import { withDashboardLineMovementUi } from "../src/dashboard-line-movement-ui.js";
import { summarizeLineMovement } from "../src/line-movement.js";

const game = {
  id: "g1",
  season: 2026,
  week: 1,
  away_team: "New England Patriots",
  home_team: "Seattle Seahawks",
  kickoff_at: "2026-09-13T20:25:00Z",
  status: "SCHEDULED",
  closing_away_spread: null
};

test("dashboard movement UI decorates weekly game cards from stored D1 movement", () => {
  const page = withDashboardLineMovementUi("<!doctype html><html><head></head><body><div id=\"app\"></div></body></html>");
  assert.match(page, /\/api\/lines\/movement\/dashboard/);
  assert.match(page, /game-card\[data-game\]/);
  assert.match(page, /books moved/);
  assert.match(page, /movementMagnitude/);
  assert.match(page, /major/);
});

test("one point or larger movement is available for stronger dashboard emphasis", () => {
  const movement = summarizeLineMovement(game, [
    { id: 1, source: "a", away_spread: 3, captured_at: "2026-08-27T10:00:00Z" },
    { id: 2, source: "b", away_spread: 3, captured_at: "2026-08-27T10:00:00Z" },
    { id: 3, source: "a", away_spread: 4, captured_at: "2026-08-28T10:00:00Z" },
    { id: 4, source: "b", away_spread: 4, captured_at: "2026-08-28T10:00:00Z" }
  ]);
  assert.equal(movement.movementMagnitude, 1);
  assert.equal(movement.direction, "TOWARD_HOME");
});
