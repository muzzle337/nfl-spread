import test from "node:test";
import assert from "node:assert/strict";
import { buildCurrentSeasonStats, gradeForRate, projectConsensusGame } from "../src/projection.js";

function game(overrides = {}) {
  return {
    id: "target-1",
    season: 2026,
    week: 4,
    seasonType: "REGULAR",
    awayTeam: "Away Team",
    homeTeam: "Home Team",
    medianAwaySpread: -2.5,
    medianHomeSpread: 2.5,
    ...overrides
  };
}

test("current-season stats are grouped by side classification and locked spread tier", () => {
  const stats = buildCurrentSeasonStats([
    { awaySpread: -2.5, homeSpread: 2.5, awayScore: 24, homeScore: 20 },
    { awaySpread: -3, homeSpread: 3, awayScore: 20, homeScore: 21 },
    { awaySpread: -6.5, homeSpread: 6.5, awayScore: 28, homeScore: 20 }
  ]);

  assert.equal(stats.gamesConsidered, 3);
  assert.equal(stats.buckets["AwayFav|<=3"].wins, 1);
  assert.equal(stats.buckets["AwayFav|<=3"].losses, 1);
  assert.equal(stats.buckets["AwayFav|<=3"].coverRate, 50);
  assert.equal(stats.buckets["HomeDog|<=3"].coverRate, 50);
  assert.equal(stats.buckets["AwayFav|<=7"].coverRate, 100);
});

test("pushes are tracked but excluded from cover-rate decisions", () => {
  const stats = buildCurrentSeasonStats([
    { awaySpread: -3, homeSpread: 3, awayScore: 24, homeScore: 21 },
    { awaySpread: -2.5, homeSpread: 2.5, awayScore: 24, homeScore: 20 }
  ]);

  const bucket = stats.buckets["AwayFav|<=3"];
  assert.equal(bucket.wins, 1);
  assert.equal(bucket.losses, 0);
  assert.equal(bucket.pushes, 1);
  assert.equal(bucket.decisions, 1);
  assert.equal(bucket.coverRate, 100);
});

test("projection chooses the stronger current-season side and assigns focus grade", () => {
  const stats = {
    buckets: {
      "AwayFav|<=3": { classification: "AwayFav", tier: "<=3", wins: 7, losses: 3, pushes: 0, decisions: 10, coverRate: 70 },
      "HomeDog|<=3": { classification: "HomeDog", tier: "<=3", wins: 3, losses: 7, pushes: 0, decisions: 10, coverRate: 30 }
    }
  };

  const result = projectConsensusGame(game(), stats);
  assert.equal(result.projectionStatus, "READY");
  assert.equal(result.classification.tier, "<=3");
  assert.equal(result.projectedSide, "AWAY");
  assert.equal(result.projectedTeam, "Away Team");
  assert.equal(result.projectedClassification, "AwayFav");
  assert.equal(result.projectedCoverRate, 70);
  assert.equal(result.sampleSize, 10);
  assert.equal(result.focus, true);
  assert.equal(result.grade, "A");
});

test("projection does not invent a signal when there are no completed current-season games", () => {
  const result = projectConsensusGame(game(), { buckets: {} });
  assert.equal(result.projectionStatus, "INSUFFICIENT_DATA");
  assert.equal(result.projectedSide, null);
  assert.equal(result.projectedCoverRate, null);
  assert.equal(result.focus, false);
  assert.equal(result.grade, null);
});

test("equal cover rates produce no edge", () => {
  const stats = {
    buckets: {
      "AwayFav|<=3": { classification: "AwayFav", tier: "<=3", wins: 3, losses: 2, pushes: 0 },
      "HomeDog|<=3": { classification: "HomeDog", tier: "<=3", wins: 3, losses: 2, pushes: 0 }
    }
  };

  const result = projectConsensusGame(game(), stats);
  assert.equal(result.projectionStatus, "NO_EDGE");
  assert.equal(result.projectedSide, null);
  assert.equal(result.focus, false);
});

test("focus grading keeps the existing 55/60/70 thresholds", () => {
  assert.equal(gradeForRate(54.9), null);
  assert.equal(gradeForRate(55), "C");
  assert.equal(gradeForRate(59.9), "C");
  assert.equal(gradeForRate(60), "B");
  assert.equal(gradeForRate(69.9), "B");
  assert.equal(gradeForRate(70), "A");
});

test("locked tiers classify 3 and 7 inside their current buckets", () => {
  const small = projectConsensusGame(game({ medianAwaySpread: -3, medianHomeSpread: 3 }), { buckets: {} });
  const medium = projectConsensusGame(game({ medianAwaySpread: -7, medianHomeSpread: 7 }), { buckets: {} });
  const large = projectConsensusGame(game({ medianAwaySpread: -7.5, medianHomeSpread: 7.5 }), { buckets: {} });

  assert.equal(small.classification.tier, "<=3");
  assert.equal(medium.classification.tier, "<=7");
  assert.equal(large.classification.tier, ">7");
});
