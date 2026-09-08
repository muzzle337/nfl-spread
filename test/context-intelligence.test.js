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

test("context UI always mounts a visible detail state and does not silently swallow API failures", () => {
  const html = withContextUi("<!doctype html><html><body><div id=\"app\"></div></body></html>");
  assert.match(html, /Loading Context Intelligence/);
  assert.match(html, /Context data could not load/);
  assert.match(html, /Context API loaded, but/);
  assert.match(html, /ctxError/);
  assert.match(html, /getJson/);
});

test("context UI surfaces all captured weather and team metric fields", () => {
  const html = withContextUi("<!doctype html><html><body><div id=\"app\"></div></body></html>");
  for (const token of [
    "Temperature", "Feels like", "Wind", "Gusts", "Precip chance", "Precip amount", "Snowfall", "Weather code",
    "Points for", "Points against", "Point diff", "Off EPA", "Def EPA", "Success rate", "Rest", "Coach", "QB",
    "Forecast hour", "Metrics:", "Data Quality", "nflverse", "nfldata", "Open-Meteo"
  ]) assert.match(html, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("embedded Context browser script compiles", () => {
  const html = withContextUi("<!doctype html><html><body><div id=\"app\"></div></body></html>");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.ok(scripts.length > 0);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
});

test("context verification UI exposes source status data quality and sync diagnostics", () => {
  const html = withContextUi("<!doctype html><html><body><div id=\"app\"></div></body></html>");
  assert.match(html, /sourceStatus/);
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

test("v0.13.2 health advertises hardened full-field Context rendering and prediction separation", () => {
  const body = contextHealth({ ok: true });
  assert.equal(APP_VERSION, "0.13.2");
  assert.equal(body.version, APP_VERSION);
  assert.equal(body.contextIntelligence, true);
  assert.equal(body.contextAffectsPredictions, false);
  assert.equal(body.contextDiagnostics, true);
  assert.equal(body.contextProvenance, true);
  assert.equal(body.contextRenderingHardened, true);
  assert.equal(body.contextFullCapturedFields, true);
  assert.deepEqual(body.contextSources, ["nfldata", "nflverse", "open-meteo"]);
});
