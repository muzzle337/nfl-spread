import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSeasonSchedule, scheduleKickoff } from "../src/schedule-sync.js";

test("season schedule normalization keeps regular weeks browsable without market data", () => {
  const games = normalizeSeasonSchedule([
    { game_id: "2026_01_BUF_HOU", week: "1", gameday: "2026-09-13", gametime: "13:00", away_team: "BUF", home_team: "HOU" },
    { game_id: "2026_02_DEN_KC", week: "2", gameday: "2026-09-20", gametime: "20:20", away_team: "DEN", home_team: "KC" },
    { game_id: "2026_19_X_Y", week: "19", gameday: "2027-01-17", away_team: "X", home_team: "Y" }
  ], 2026);
  assert.equal(games.length, 2);
  assert.deepEqual(games.map((game) => game.week), [1, 2]);
  assert.equal(games[1].kickoffAt, "2026-09-21T00:20:00.000Z");
});

test("schedule kickoff converts winter eastern time after daylight saving", () => {
  assert.equal(scheduleKickoff({ gameday: "2026-12-20", gametime: "13:00" }), "2026-12-20T18:00:00.000Z");
});
