import test from "node:test";
import assert from "node:assert/strict";
import { nflRegularSeasonStartUtc, nflWeekForCommenceTime, selectEarliestUpcomingWeek } from "../src/ingestion.js";

test("2026 NFL regular season start resolves to Thursday after Labor Day", () => {
  assert.equal(nflRegularSeasonStartUtc(2026).toISOString(), "2026-09-10T00:00:00.000Z");
});

test("NFL week resolver keeps Thursday through following Wednesday in the same week", () => {
  assert.deepEqual(nflWeekForCommenceTime("2026-09-10T00:15:00Z"), {
    season: 2026,
    week: 1,
    seasonType: "REGULAR"
  });
  assert.deepEqual(nflWeekForCommenceTime("2026-09-15T00:15:00Z"), {
    season: 2026,
    week: 1,
    seasonType: "REGULAR"
  });
  assert.deepEqual(nflWeekForCommenceTime("2026-09-18T00:15:00Z"), {
    season: 2026,
    week: 2,
    seasonType: "REGULAR"
  });
});

test("earliest upcoming week excludes later-week games", () => {
  const games = [
    { id: "week-2", commenceTime: "2026-09-18T00:15:00Z", books: [] },
    { id: "week-1-sun", commenceTime: "2026-09-13T17:00:00Z", books: [] },
    { id: "week-1-thu", commenceTime: "2026-09-10T00:15:00Z", books: [] }
  ];

  const selected = selectEarliestUpcomingWeek(games, new Date("2026-08-27T23:00:00Z"));
  assert.equal(selected.season, 2026);
  assert.equal(selected.week, 1);
  assert.deepEqual(selected.games.map((game) => game.id), ["week-1-thu", "week-1-sun"]);
});

test("already-started games are not selected for ingestion", () => {
  const selected = selectEarliestUpcomingWeek([
    { id: "past", commenceTime: "2026-09-10T00:15:00Z", books: [] },
    { id: "future", commenceTime: "2026-09-13T17:00:00Z", books: [] }
  ], new Date("2026-09-12T00:00:00Z"));

  assert.deepEqual(selected.games.map((game) => game.id), ["future"]);
});
