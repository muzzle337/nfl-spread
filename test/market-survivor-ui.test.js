import test from "node:test";
import assert from "node:assert/strict";
import { withMoneylineSurvivorUi } from "../src/moneyline-survivor-ui.js";

test("market UI places spread and moneyline on team rows", () => {
  const html = withMoneylineSurvivorUi("<html><body><div id=\"app\"></div></body></html>");
  assert.match(html, /team-market/);
  assert.match(html, /medianAwaySpread/);
  assert.match(html, /consensusAwayMoneyline/);
  assert.match(html, /consensusHomeMoneyline/);
});

test("Survivor UI shows full field with win percentage first and sorting", () => {
  const html = withMoneylineSurvivorUi("<html><body><div id=\"app\"></div></body></html>");
  assert.doesNotMatch(html, /slice\(0,10\)/);
  assert.match(html, /Win % · High to Low/);
  assert.match(html, /Moneyline · Favorite First/);
  assert.match(html, /Spread · Favorite First/);
  assert.match(html, /survivor-pct/);
  assert.match(html, /Spread <strong>/);
  assert.match(html, /Used/);
});
