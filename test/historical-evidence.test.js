import test from "node:test";
import assert from "node:assert/strict";
import { buildHistoricalEvidenceSummaries, historicalSubjectSummary } from "../src/historical-evidence.js";
import { currentHistoricalConditions, phaseTwoEvidence } from "../src/history-matchups.js";

function game(index, overrides = {}) {
  const win = index < 4;
  return {
    season: 2023 + (index % 3), week: index + 1,
    away_team: "CAR", home_team: "ATL",
    away_score: win ? 24 : 20, home_score: win ? 20 : 19,
    spread_line: -2.5, roof: "outdoors", temp_f: 70, wind_mph: 8,
    away_rest: 7, home_rest: 7, away_coach: "Coach C", home_coach: "Coach A",
    div_game: 1, prime_time: 0,
    ...overrides
  };
}

test("team evidence reconciles category/tier ATS results and excludes future seasons", () => {
  const rows = Array.from({ length: 6 }, (_, index) => game(index));
  rows.push(game(7, { season: 2026, away_score: 40, home_score: 3 }));
  const summaries = buildHistoricalEvidenceSummaries(rows);
  const car = summaries.teams.get("CAR");
  const split = car.categoryTier["AwayFav|<=3"];

  assert.deepEqual(split.spreadRecord, { covers: 4, noCovers: 2, pushes: 0, coverPct: 66.7 });
  assert.equal(split.games, 6);
  assert.deepEqual(car.timeframe, { fromSeason: 2023, toSeason: 2025 });
  assert.equal(summaries.coaches.get("Coach C").categoryTier["AwayFav|<=3"].games, 6);
  assert.equal(summaries.league.categoryTier["AwayFav|<=3"].games, 6);
});

test("historical summaries retain raw records without manufacturing a confidence grade", () => {
  const summary = historicalSubjectSummary([
    { season: 2025, outright: "W", covered: "W", side: "AWAY", favorite: false, classification: "AwayDog", tier: "<=3", division: false },
    { season: 2025, outright: "L", covered: "P", side: "AWAY", favorite: false, classification: "AwayDog", tier: "<=3", division: false }
  ], "SEA", "TEAM");

  assert.deepEqual(summary.categoryTier["AwayDog|<=3"].spreadRecord, { covers: 1, noCovers: 0, pushes: 1, coverPct: 100 });
  assert.equal("grade" in summary, false);
  assert.equal("confidence" in summary, false);
  assert.equal("probability" in summary, false);
});

test("matchup evidence is relevance-ranked, baseline-aware, and limited to three items", () => {
  const rows = Array.from({ length: 6 }, (_, index) => game(index));
  for (let index = 0; index < 6; index += 1) {
    rows.push(game(index, {
      away_team: "TB", home_team: "NO", away_coach: "Coach T", home_coach: "Coach N",
      away_score: index < 3 ? 24 : 20, home_score: index < 3 ? 20 : 19
    }));
  }
  const cache = buildHistoricalEvidenceSummaries(rows);
  const current = {
    awayCode: "CAR", homeCode: "ATL", awayCoach: "Coach C", homeCoach: "Coach A",
    kickoffAt: "2026-09-20T17:00:00Z", roof: "dome", awayRest: 7, homeRest: 7,
    classification: { away: "AwayFav", home: "HomeDog", tier: "<=3" }, projectedCode: "CAR"
  };
  const evidence = phaseTwoEvidence(current, currentHistoricalConditions(current), cache);

  assert.ok(evidence.length >= 1 && evidence.length <= 3);
  assert.equal(evidence[0].subjectType, "TEAM");
  assert.equal(evidence[0].team, "CAR");
  assert.equal(evidence[0].label, "Away Favorite · 0.5–3");
  assert.equal(evidence[0].relationship, "SUPPORTS");
  assert.equal(evidence[0].baseline.coverPct, 58.3);
});
