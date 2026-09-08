import test from "node:test";
import assert from "node:assert/strict";
import { coachIndicatorSummary, isPrimeTimeGame, normalizeHistoricalGame } from "../src/history.js";
import { withHistoryUi } from "../src/history-ui.js";
import { APP_VERSION } from "../src/v015-entry.js";

function row(overrides = {}) {
  return {
    game_id: "2024_01_AAA_BBB", season: 2024, week: 1, game_type: "REG",
    gameday: "2024-09-08", weekday: "Sunday", gametime: "20:20", prime_time: 1,
    away_team: "AAA", home_team: "BBB", away_score: 20, home_score: 27,
    result: 7, spread_line: 3.5, total_line: 47.5,
    roof: "outdoors", surface: "grass", temp_f: 28, wind_mph: 18,
    away_rest: 7, home_rest: 10, away_coach: "Away Coach", home_coach: "Home Coach",
    div_game: 1, ...overrides
  };
}

test("historical schedule normalization keeps coach/weather/rest/spread fields", () => {
  const source = row({ temp: 28, wind: 18 });
  const g = normalizeHistoricalGame(source);
  assert.equal(g.homeCoach, "Home Coach");
  assert.equal(g.tempF, 28);
  assert.equal(g.windMph, 18);
  assert.equal(g.homeRest, 10);
  assert.equal(g.spreadLine, 3.5);
  assert.equal(g.primeTime, 1);
});

test("primetime uses the nflverse Eastern kickoff window", () => {
  assert.equal(isPrimeTimeGame({ gametime:"20:20" }), true);
  assert.equal(isPrimeTimeGame({ gametime:"19:15" }), true);
  assert.equal(isPrimeTimeGame({ gametime:"16:25" }), false);
  assert.equal(isPrimeTimeGame({ gametime:"13:00" }), false);
});

test("coach indicators expose record, spread record and situational samples", () => {
  const rows = [
    row(),
    row({ game_id:"g2", season:2023, gametime:"13:00", prime_time:0, home_score:17, away_score:20, result:-3, spread_line:2.5, temp_f:75, wind_mph:4, home_rest:7, away_rest:7, div_game:0 }),
    row({ game_id:"g3", season:2022, home_score:30, away_score:10, result:20, spread_line:7, temp_f:95, wind_mph:3, home_rest:8, away_rest:6, div_game:0 })
  ];
  const summary = coachIndicatorSummary(rows, "Home Coach");
  assert.equal(summary.overall.games, 3);
  assert.deepEqual(summary.overall.record, { wins:2, losses:1, ties:0, winPct:66.7 });
  assert.deepEqual(summary.overall.spreadRecord, { covers:2, noCovers:1, pushes:0, coverPct:66.7 });
  assert.equal(summary.indicators.primeTime.games, 2);
  assert.equal(summary.indicators.coldOutdoor.games, 1);
  assert.equal(summary.indicators.hotOutdoor.games, 1);
  assert.equal(summary.indicators.windyOutdoor.games, 1);
  assert.equal(summary.indicators.restAdvantage3Plus.games, 1);
});

test("history UI is idempotent and does not reintroduce MutationObserver", () => {
  const html = withHistoryUi("<!doctype html><html><body><div id=\"app\"></div></body></html>");
  assert.match(html, /Load Historical Data/);
  assert.doesNotMatch(html, /MutationObserver/);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  scripts.forEach((script) => assert.doesNotThrow(() => new Function(script)));
});

test("v0.15 history foundation remains available under later wrappers", () => {
  assert.equal(APP_VERSION, "0.15.0");
});
