import test from "node:test";
import assert from "node:assert/strict";
import { finalScoreUpdate, ingestCompletedScores } from "../src/results.js";

test("finalScoreUpdate accepts only completed games with valid non-negative integer scores", () => {
  assert.deepEqual(finalScoreUpdate({
    id: "g1",
    completed: true,
    awayTeam: "Away",
    homeTeam: "Home",
    awayScore: 24,
    homeScore: 20
  }), {
    id: "g1",
    awayTeam: "Away",
    homeTeam: "Home",
    awayScore: 24,
    homeScore: 20
  });

  assert.equal(finalScoreUpdate({ id: "g2", completed: false, awayScore: 24, homeScore: 20 }), null);
  assert.equal(finalScoreUpdate({ id: "g3", completed: true, awayScore: -1, homeScore: 20 }), null);
  assert.equal(finalScoreUpdate({ id: "g4", completed: true, awayScore: 24.5, homeScore: 20 }), null);
});

function fakeDb({ existing = null, spreads = [] } = {}) {
  const updates = [];

  return {
    updates,
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        bind(...args) {
          return {
            async first() {
              if (normalized.startsWith("SELECT id, status")) return existing;
              throw new Error(`Unexpected first query: ${normalized}`);
            },
            async all() {
              if (normalized.startsWith("SELECT away_spread")) {
                return { results: spreads.map((away_spread) => ({ away_spread })) };
              }
              throw new Error(`Unexpected all query: ${normalized}`);
            },
            async run() {
              if (normalized.startsWith("UPDATE games")) {
                updates.push(args);
                return { success: true };
              }
              throw new Error(`Unexpected run query: ${normalized}`);
            }
          };
        }
      };
    }
  };
}

test("completed score ingestion stores final scores, COMPLETED status, and latest consensus as closing line", async () => {
  const db = fakeDb({
    existing: {
      id: "g1",
      status: "SCHEDULED",
      away_score: null,
      home_score: null,
      closing_away_spread: null
    },
    spreads: [-3.5, -3.5, -3, -3.5, -3]
  });

  const summary = await ingestCompletedScores(db, [{
    id: "g1",
    completed: true,
    awayTeam: "Away",
    homeTeam: "Home",
    awayScore: 27,
    homeScore: 20
  }]);

  assert.equal(summary.gamesUpdated, 1);
  assert.equal(summary.completedReceived, 1);
  assert.equal(db.updates.length, 1);
  assert.deepEqual(db.updates[0], [27, 20, -3.5, "g1"]);
});

test("live scores are ignored so they cannot become final projection inputs", async () => {
  const db = fakeDb();
  const summary = await ingestCompletedScores(db, [{
    id: "g1",
    completed: false,
    awayScore: 14,
    homeScore: 10
  }]);

  assert.equal(summary.nonFinalIgnored, 1);
  assert.equal(summary.gamesUpdated, 0);
  assert.equal(db.updates.length, 0);
});

test("completed games that were never stored are skipped rather than creating spreadless history", async () => {
  const db = fakeDb({ existing: null });
  const summary = await ingestCompletedScores(db, [{
    id: "missing",
    completed: true,
    awayScore: 21,
    homeScore: 17
  }]);

  assert.equal(summary.gamesNotStored, 1);
  assert.equal(summary.gamesUpdated, 0);
});

test("an already finalized game with the same scores and closing line is idempotent", async () => {
  const db = fakeDb({
    existing: {
      id: "g1",
      status: "COMPLETED",
      away_score: 21,
      home_score: 17,
      closing_away_spread: 2.5
    }
  });

  const summary = await ingestCompletedScores(db, [{
    id: "g1",
    completed: true,
    awayScore: 21,
    homeScore: 17
  }]);

  assert.equal(summary.gamesUnchanged, 1);
  assert.equal(summary.gamesUpdated, 0);
  assert.equal(db.updates.length, 0);
});
