import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/pwa-entry.js";
import { lineMovementForGame, summarizeLineMovement } from "../src/line-movement.js";
import { withLineMovementUi } from "../src/line-movement-ui.js";

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

const snapshots = [
  { id: 1, source: "a", away_spread: 3.5, captured_at: "2026-08-27T10:00:00Z" },
  { id: 2, source: "b", away_spread: 3.5, captured_at: "2026-08-27T10:00:00Z" },
  { id: 3, source: "c", away_spread: 3, captured_at: "2026-08-27T10:00:00Z" },
  { id: 4, source: "a", away_spread: 4, captured_at: "2026-08-28T10:00:00Z" },
  { id: 5, source: "c", away_spread: 4, captured_at: "2026-08-28T10:00:00Z" }
];

function fakeDb() {
  return {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        bind(id) {
          return {
            async first() {
              if (normalized.startsWith("SELECT id, season, week")) return id === "g1" ? game : null;
              throw new Error(`Unexpected first query: ${normalized}`);
            },
            async all() {
              if (normalized.startsWith("SELECT id, source, away_spread")) return { results: id === "g1" ? snapshots : [] };
              throw new Error(`Unexpected all query: ${normalized}`);
            }
          };
        }
      };
    }
  };
}

test("line movement compares first stored bookmaker lines with latest stored lines", () => {
  const movement = summarizeLineMovement(game, snapshots);

  assert.equal(movement.firstCapturedAwaySpread, 3.5);
  assert.equal(movement.currentAwaySpread, 4);
  assert.equal(movement.movementPointsAway, 0.5);
  assert.equal(movement.movementMagnitude, 0.5);
  assert.equal(movement.direction, "TOWARD_HOME");
  assert.equal(movement.bookmakerCount, 3);
  assert.equal(movement.changedBookmakers, 2);
  assert.equal(movement.snapshotCount, 5);
});

test("negative away-spread movement means the market moved toward the away team", () => {
  const movement = summarizeLineMovement(game, [
    { id: 1, source: "a", away_spread: -2.5, captured_at: "2026-08-27T10:00:00Z" },
    { id: 2, source: "b", away_spread: -2.5, captured_at: "2026-08-27T10:00:00Z" },
    { id: 3, source: "a", away_spread: -3, captured_at: "2026-08-28T10:00:00Z" },
    { id: 4, source: "b", away_spread: -3, captured_at: "2026-08-28T10:00:00Z" }
  ]);

  assert.equal(movement.firstCapturedAwaySpread, -2.5);
  assert.equal(movement.currentAwaySpread, -3);
  assert.equal(movement.movementPointsAway, -0.5);
  assert.equal(movement.direction, "TOWARD_AWAY");
});

test("closing line is kept separate from current movement and can remain pending", () => {
  const pending = summarizeLineMovement(game, []);
  assert.equal(pending.firstCapturedAwaySpread, null);
  assert.equal(pending.currentAwaySpread, null);
  assert.equal(pending.closingAwaySpread, null);
  assert.equal(pending.direction, "UNKNOWN");

  const completed = summarizeLineMovement({ ...game, status: "COMPLETED", closing_away_spread: 4.5 }, [
    { id: 1, source: "a", away_spread: 3.5, captured_at: "2026-08-27T10:00:00Z" },
    { id: 2, source: "a", away_spread: 4, captured_at: "2026-09-13T20:00:00Z" }
  ]);
  assert.equal(completed.currentAwaySpread, 4);
  assert.equal(completed.closingAwaySpread, 4.5);
});

test("movement lookup reads only stored D1 game and snapshot data", async () => {
  const movement = await lineMovementForGame(fakeDb(), "g1");
  assert.equal(movement.gameId, "g1");
  assert.equal(movement.currentAwaySpread, 4);
  assert.equal(movement.direction, "TOWARD_HOME");
  assert.equal(await lineMovementForGame(fakeDb(), "missing"), null);
});

test("public movement endpoint is D1-only and returns the stored summary", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/lines/movement?game=g1"), { DB: fakeDb() });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.movement.firstCapturedAwaySpread, 3.5);
  assert.equal(body.movement.currentAwaySpread, 4);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("line movement UI explains that first captured is not guaranteed sportsbook opening", () => {
  const page = withLineMovementUi("<!doctype html><html><head></head><body><div id=\"app\"></div></body></html>");
  assert.match(page, /Line Movement/);
  assert.match(page, /First Captured/);
  assert.match(page, /not guaranteed to be the sportsbook opening line/);
  assert.match(page, /\/api\/lines\/movement\?game=/);
  assert.match(page, /Moved/);
});
