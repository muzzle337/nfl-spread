import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { currentHistoricalConditions, isCurrentPrimeTime, notableHistoricalSplit } from "../src/history-matchups.js";
import { withHistoryMatchupUi } from "../src/history-matchup-ui.js";
import { APP_VERSION } from "../src/v016-entry.js";

test("current primetime detects NFL evening UTC windows", () => {
  assert.equal(isCurrentPrimeTime("2026-09-15T00:15:00Z"), true);
  assert.equal(isCurrentPrimeTime("2026-09-13T17:00:00Z"), false);
  assert.equal(isCurrentPrimeTime("2026-09-13T20:25:00Z"), false);
});

test("current matchup conditions map weather and rest only when applicable", () => {
  const c = currentHistoricalConditions({
    kickoffAt:"2026-09-15T00:15:00Z", roof:"outdoors", awayRest:10, homeRest:6,
    weather:{ temperatureF:28, windMph:17 }
  });
  assert.equal(c.primeTime, true);
  assert.deepEqual(c.away, ["away","primeTime","coldOutdoor","windyOutdoor","extraRest","restAdvantage3Plus"]);
  assert.deepEqual(c.home, ["home","primeTime","coldOutdoor","windyOutdoor","shortRest"]);
});

test("dome games do not turn outdoor weather into historical conditions", () => {
  const c = currentHistoricalConditions({ kickoffAt:"2026-09-13T20:25:00Z", roof:"dome", awayRest:7, homeRest:7, weather:{ temperatureF:96, windMph:20 } });
  assert.equal(c.outdoor, false);
  assert.deepEqual(c.away, ["away"]);
  assert.deepEqual(c.home, ["home"]);
});

test("notable history requires sample and meaningful rate", () => {
  assert.equal(notableHistoricalSplit({ games:4, record:{winPct:90}, spreadRecord:{coverPct:90} }), false);
  assert.equal(notableHistoricalSplit({ games:10, record:{winPct:68}, spreadRecord:{coverPct:55} }), true);
  assert.equal(notableHistoricalSplit({ games:10, record:{winPct:52}, spreadRecord:{coverPct:61} }), true);
  assert.equal(notableHistoricalSplit({ games:10, record:{winPct:52}, spreadRecord:{coverPct:52} }), false);
});

test("historical matchup UI shows actual records, samples, and no MutationObserver", () => {
  const html = withHistoryMatchupUi("<!doctype html><html><body><div id=\"app\"></div></body></html>");
  assert.match(html, /Historical Indicators This Week/);
  assert.match(html, /n=/);
  assert.match(html, /cover/);
  assert.match(html, /2015–2025/);
  assert.doesNotMatch(html, /MutationObserver/);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  scripts.forEach((script) => assert.doesNotThrow(() => new Function(script)));
});

test("v0.16 exposes the historical matchup bridge", () => {
  assert.equal(APP_VERSION, "0.16.0");
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(config, /"main"\s*:\s*"src\/v016-entry\.js"/);
});
