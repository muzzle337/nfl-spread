import test from "node:test";
import assert from "node:assert/strict";
import { withSurvivorV012Ui } from "../src/survivor-v012-ui.js";

test("v0.12 Survivor loads one analytics payload for instant entry switching", () => {
  const html = withSurvivorV012Ui("<!doctype html><html><body><div id=\"app\"></div></body></html>");
  assert.match(html, /\/api\/survivor\/analytics\?season=/);
  assert.match(html, /selectedEntry=v\?Number\(v\):null;render\(\)/);
  assert.doesNotMatch(html, /\/api\/survivor\?season=.*entry=/);
});

test("v0.12 Survivor surfaces six-entry command center and transparent analytics", () => {
  const html = withSurvivorV012Ui("<!doctype html><html><body></body></html>");
  assert.match(html, /s12-command/);
  assert.match(html, /PURE SAFETY/);
  assert.match(html, /STRATEGIC VALUE/);
  assert.match(html, /Available /);
  assert.match(html, /Selected /);
  assert.match(html, /Agreement /);
  assert.match(html, /Schedule scarcity/);
  assert.match(html, /Historical probability calibration/);
  assert.match(html, /Win probability is never replaced by a composite score/);
});

test("v0.12 Survivor confirms picks before writing and refreshes analytics only after a pick", () => {
  const html = withSurvivorV012Ui("<!doctype html><html><body></body></html>");
  assert.match(html, /confirm\('Use '/);
  assert.match(html, /\/api\/survivor\/picks/);
  assert.match(html, /Refreshing after pick/);
});
