import test from "node:test";
import assert from "node:assert/strict";
import {
  americanToImpliedProbability,
  consensusMoneylineForGame,
  noVigProbabilities,
  probabilityToAmerican
} from "../src/moneyline.js";
import { buildNflMarketsUrl, normalizeNflMarkets } from "../src/odds.js";

test("NFL market request asks for spreads and h2h in one US-region call", () => {
  const url = buildNflMarketsUrl("secret-test-key");
  assert.equal(url.pathname, "/v4/sports/americanfootball_nfl/odds");
  assert.equal(url.searchParams.get("regions"), "us");
  assert.equal(url.searchParams.get("markets"), "spreads,h2h");
  assert.equal(url.searchParams.get("oddsFormat"), "american");
});

test("market normalization keeps spread and moneyline separate", () => {
  const [game] = normalizeNflMarkets([{
    id: "g1",
    sport_key: "americanfootball_nfl",
    commence_time: "2026-09-13T17:00:00Z",
    away_team: "Buffalo Bills",
    home_team: "Miami Dolphins",
    bookmakers: [{
      key: "book",
      title: "Book",
      markets: [
        { key: "spreads", outcomes: [{ name: "Buffalo Bills", point: -6.5 }, { name: "Miami Dolphins", point: 6.5 }] },
        { key: "h2h", outcomes: [{ name: "Buffalo Bills", price: -285 }, { name: "Miami Dolphins", price: 235 }] }
      ]
    }]
  }]);

  assert.equal(game.books[0].awaySpread, -6.5);
  assert.equal(game.books[0].homeSpread, 6.5);
  assert.equal(game.books[0].awayMoneyline, -285);
  assert.equal(game.books[0].homeMoneyline, 235);
});

test("American moneyline converts to implied probability", () => {
  assert.ok(Math.abs(americanToImpliedProbability(-200) - (2 / 3)) < 0.00001);
  assert.ok(Math.abs(americanToImpliedProbability(200) - (1 / 3)) < 0.00001);
});

test("no-vig probabilities normalize both sides to 100 percent", () => {
  const result = noVigProbabilities(-200, 170);
  assert.ok(result.away > result.home);
  assert.ok(Math.abs(result.away + result.home - 1) < 0.000001);
});

test("probability converts back to a usable American price", () => {
  assert.equal(probabilityToAmerican(2 / 3), -200);
  assert.equal(probabilityToAmerican(1 / 3), 200);
});

test("moneyline consensus reports median prices and averaged no-vig win probability", () => {
  const result = consensusMoneylineForGame({ id: "g1" }, [
    { source: "a", away_moneyline: -300, home_moneyline: 240, captured_at: "2026-09-07T10:00:00Z" },
    { source: "b", away_moneyline: -280, home_moneyline: 230, captured_at: "2026-09-07T10:00:00Z" },
    { source: "c", away_moneyline: -290, home_moneyline: 235, captured_at: "2026-09-07T10:00:00Z" }
  ]);

  assert.equal(result.consensusAwayMoneyline, -290);
  assert.equal(result.consensusHomeMoneyline, 235);
  assert.equal(result.moneylineBookmakerCount, 3);
  assert.ok(result.awayWinProbability > 70);
  assert.ok(result.homeWinProbability < 30);
});
