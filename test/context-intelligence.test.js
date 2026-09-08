import test from "node:test";
import assert from "node:assert/strict";
import { buildContextObservations } from "../src/context.js";
import { mergeContextGame, normalizeScheduleRow, teamCode } from "../src/context-sources.js";
import { withContextUi } from "../src/context-ui.js";
import { withAdminPinUi } from "../src/admin-pin-ui.js";
import { APP_VERSION, contextHealth } from "../src/v013-entry.js";

test("team names normalize to nflverse abbreviations", () => {
  assert.equal(teamCode("Buffalo Bills"), "BUF");
  assert.equal(teamCode("KC"), "KC");
});

test("schedule adapter preserves venue, rest, coach, and starting QB context", () => {
  const row = normalizeScheduleRow({
    game_id: "2026_01_BUF_MIA",
    away_team: "BUF",
    home_team: "MIA",
    stadium: "Example Stadium",
    roof: "outdoors",
    surface: "grass",
    away_rest: "7",
    home_rest: "10",
    away_coach: "Away Coach",
    home_coach: "Home Coach",
    away_qb_name: "Away QB",
    home_qb_name: "Home QB"
  });
  assert.equal(row.awayTeam, "BUF");
  assert.equal(row.homeTeam, "MIA");
  assert.equal(row.awayRest, 7);
  assert.equal(row.homeRest, 10);
  assert.equal(row.roof, "outdoors");
  assert.equal(row.awayCoach, "Away Coach");
  assert.equal(row.homeQb, "Home QB");
});

test("nflverse context wins while nfldata can fill missing fields", () => {
  const merged = mergeContextGame(
    { away_team: "BUF", home_team: "MIA", stadium: "Primary Stadium", away_rest: 7 },
    { away_team: "BUF", home_team: "MIA", stadium: "Fallback", surface: "grass", home_rest: 9 }
  );
  assert.equal(merged.stadium, "Primary Stadium");
  assert.equal(merged.surface, "grass");
  assert.equal(merged.homeRest, 9);
});

test("context observations flag weather and rest without producing a pick", () => {
  const observations = buildContextObservations({
    awayCode: "BUF",
    homeCode: "CLE",
    awayRest: 10,
    homeRest: 6,
    weather: { windMph: 19, gustMph: 28, temperatureF: 30, precipitationProbability: 45 },
    awayMetrics: { pointDiff: 50, offensiveEpa: 0.18 },
    homeMetrics: { pointDiff: -10, offensiveEpa: 0.04 }
  });
  assert.ok(observations.some((o) => o.label === "Wind" && o.kind === "warning"));
  assert.ok(observations.some((o) => o.label === "Rest edge" && o.side === "AWAY"));
  assert.ok(observations.every((o) => !("pick" in o) && !("probability" in o)));
});

test("context verification UI exposes source status data quality and sync diagnostics", () => {
  const html = withContextUi("<!doctype html><html><body><div id=\"app\"></div></body></html>");
  assert.match(html, /Data Quality/);
  assert.match(html, /sourceStatus/);
  assert.match(html, /nflverse/);
  assert.match(html, /nfldata/);
  assert.match(html, /Open-Meteo/);
  assert.match(html, /matchedGames/);
  assert.match(html, /unmatchedGames/);
  assert.match(html, /teamsWithAdvancedMetrics/);
  assert.match(html, /Updating Context/);
  assert.match(html, /Context Update Failed/);
  assert.match(html, /Context Update Complete/);
});

test("admin PIN UI makes checking success and failure visible", () => {
  const html = withAdminPinUi("<!doctype html><html><body><input id=\"adminKey\"></body></html>");
  assert.match(html, /Checking PIN/);
  assert.match(html, /Admin Tools Unlocked/);
  assert.match(html, /Incorrect PIN|Try the PIN again/);
  assert.match(html, /Updating Lines/);
  assert.match(html, /Checking Final Scores/);
});

test("v0.13.1 health advertises context diagnostics provenance and separation from predictions", () => {
  const body = contextHealth({ ok: true });
  assert.equal(APP_VERSION, "0.13.1");
  assert.equal(body.version, APP_VERSION);
  assert.equal(body.contextIntelligence, true);
  assert.equal(body.contextAffectsPredictions, false);
  assert.equal(body.contextDiagnostics, true);
  assert.equal(body.contextProvenance, true);
  assert.deepEqual(body.contextSources, ["nfldata", "nflverse", "open-meteo"]);
});
