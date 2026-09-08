import test from "node:test";
import assert from "node:assert/strict";
import { buildOpportunity, buildOpportunityBoard } from "../src/context-opportunity.js";
import { withContextOpportunityUi } from "../src/context-opportunity-ui.js";
import { APP_VERSION } from "../src/v014-entry.js";

function baseGame(overrides = {}) {
  return {
    gameId: "2026_01_NE_SEA",
    awayCode: "NE",
    homeCode: "SEA",
    awayRest: 7,
    homeRest: 7,
    weather: null,
    awayMetrics: null,
    homeMetrics: null,
    quality: { loaded: 3, total: 9 },
    ...overrides
  };
}

test("Opportunity score stays transparent and separate from prediction probability", () => {
  const result = buildOpportunity(baseGame({
    homeRest: 11,
    weather: { windMph: 21, gustMph: 36, precipitationProbability: 70 },
    awayMetrics: { pointDiff: -25, offensiveEpa: -0.08, defensiveEpa: 0.12, successRate: 0.39 },
    homeMetrics: { pointDiff: 35, offensiveEpa: 0.12, defensiveEpa: -0.05, successRate: 0.51 },
    quality: { loaded: 9, total: 9 }
  }));
  assert.equal(result.level, "HIGH");
  assert.equal(result.directionalTeam, "SEA");
  assert.ok(result.signals.some((s) => s.label === "Rest edge"));
  assert.ok(result.signals.some((s) => s.label === "Offensive EPA gap"));
  assert.ok(result.signals.some((s) => s.label === "Defensive EPA gap"));
  assert.ok(result.signals.some((s) => s.label === "Success-rate gap"));
  assert.equal("probability" in result, false);
  assert.equal("pick" in result, false);
});

test("weather-only context can create a watch without pretending to favor a side", () => {
  const result = buildOpportunity(baseGame({
    weather: { windMph: 18, precipitationProbability: 50 },
    quality: { loaded: 5, total: 9 }
  }));
  assert.ok(["WATCH", "MEDIUM"].includes(result.level));
  assert.equal(result.directionalSide, null);
  assert.equal(result.directionalTeam, null);
});

test("Opportunity Board ranks stronger signal clusters first", () => {
  const board = buildOpportunityBoard([
    baseGame({ gameId: "a", weather: { windMph: 16 }, quality: { loaded: 5, total: 9 } }),
    baseGame({ gameId: "b", homeRest: 13, weather: { windMph: 22, gustMph: 38 }, quality: { loaded: 8, total: 9 } })
  ]);
  assert.equal(board[0].gameId, "b");
  assert.ok(board[0].score > board[1].score);
});

test("v0.14 renderer has no MutationObserver and exposes full Context sections", () => {
  const html = withContextOpportunityUi("<!doctype html><html><body><div id=\"app\" class=\"app-shell\"></div></body></html>");
  assert.doesNotMatch(html, /MutationObserver/);
  for (const token of [
    "Things to Watch This Week", "Context Intelligence", "Kickoff Weather", "Source Verification",
    "Off EPA", "Def EPA", "Success", "Rest", "Coach", "QB", "Data quality", "Update Context"
  ]) assert.match(html, new RegExp(token));
});

test("embedded v0.14 browser script compiles", () => {
  const html = withContextOpportunityUi("<!doctype html><html><body><div id=\"app\"></div></body></html>");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length > 0);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
});

test("v0.14 wrapper advances the public app version", () => {
  assert.equal(APP_VERSION, "0.14.0");
});
