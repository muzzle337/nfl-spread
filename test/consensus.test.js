import test from "node:test";
import assert from "node:assert/strict";
import { consensusForGame, median } from "../src/consensus.js";

test("median returns the middle sportsbook line for an odd number of books", () => {
  assert.equal(median([-2, -1.5, -1]), -1.5);
});

test("median averages the two middle sportsbook lines for an even number of books", () => {
  assert.equal(median([-2, -1.5, -1, -0.5]), -1.25);
});

test("median ignores non-numeric values and returns null when no valid lines exist", () => {
  assert.equal(median([-3, null, "bad", -2]), -2.5);
  assert.equal(median([null, "bad"]), null);
});

test("consensus uses each latest bookmaker line and preserves audit details", () => {
  const result = consensusForGame({
    id: "game-1",
    season: 2026,
    week: 1,
    season_type: "REGULAR",
    away_team: "Buffalo Bills",
    home_team: "Houston Texans",
    kickoff_at: "2026-09-13T17:00:00Z",
    status: "SCHEDULED"
  }, [
    { source: "book-c", away_spread: 1, captured_at: "2026-08-28T00:00:00Z" },
    { source: "book-a", away_spread: -1.5, captured_at: "2026-08-28T00:00:00Z" },
    { source: "book-b", away_spread: 0, captured_at: "2026-08-28T00:00:00Z" }
  ]);

  assert.equal(result.medianAwaySpread, 0);
  assert.equal(result.medianHomeSpread, 0);
  assert.equal(result.bookmakerCount, 3);
  assert.equal(result.minAwaySpread, -1.5);
  assert.equal(result.maxAwaySpread, 1);
  assert.deepEqual(result.books.map((book) => book.source), ["book-a", "book-b", "book-c"]);
});
