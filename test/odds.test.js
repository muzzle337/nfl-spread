import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNflScoresUrl,
  buildNflSpreadsUrl,
  normalizeNflScores,
  normalizeNflSpreads,
  quotaFromHeaders
} from "../src/odds.js";

test("NFL spreads request uses one US spread market", () => {
  const url = buildNflSpreadsUrl("secret-test-key");
  assert.equal(url.pathname, "/v4/sports/americanfootball_nfl/odds");
  assert.equal(url.searchParams.get("regions"), "us");
  assert.equal(url.searchParams.get("markets"), "spreads");
  assert.equal(url.searchParams.get("oddsFormat"), "american");
  assert.equal(url.searchParams.get("apiKey"), "secret-test-key");
});

test("NFL score request uses the maximum three-day completed-game lookback", () => {
  const url = buildNflScoresUrl("secret-test-key", 3);
  assert.equal(url.pathname, "/v4/sports/americanfootball_nfl/scores");
  assert.equal(url.searchParams.get("daysFrom"), "3");
  assert.equal(url.searchParams.get("dateFormat"), "iso");
  assert.equal(url.searchParams.get("apiKey"), "secret-test-key");
});

test("NFL score request rejects unsupported lookback values", () => {
  assert.throws(() => buildNflScoresUrl("secret-test-key", 0), /1 to 3/);
  assert.throws(() => buildNflScoresUrl("secret-test-key", 4), /1 to 3/);
});

test("quota headers are parsed", () => {
  const headers = new Headers({
    "x-requests-used": "74",
    "x-requests-remaining": "426",
    "x-requests-last": "1"
  });
  assert.deepEqual(quotaFromHeaders(headers), {
    creditsUsedTotal: 74,
    creditsRemaining: 426,
    creditsUsedThisRequest: 1
  });
});

test("spread response is normalized without exposing prices or unrelated markets", () => {
  const input = [{
    id: "game-1",
    sport_key: "americanfootball_nfl",
    commence_time: "2026-09-13T17:00:00Z",
    away_team: "Baltimore Ravens",
    home_team: "Tampa Bay Buccaneers",
    bookmakers: [{
      key: "examplebook",
      title: "Example Book",
      last_update: "2026-09-10T12:00:00Z",
      markets: [{
        key: "spreads",
        outcomes: [
          { name: "Baltimore Ravens", point: -3.5, price: -110 },
          { name: "Tampa Bay Buccaneers", point: 3.5, price: -110 }
        ]
      }]
    }]
  }];

  assert.deepEqual(normalizeNflSpreads(input), [{
    id: "game-1",
    sportKey: "americanfootball_nfl",
    commenceTime: "2026-09-13T17:00:00Z",
    awayTeam: "Baltimore Ravens",
    homeTeam: "Tampa Bay Buccaneers",
    bookmakerCount: 1,
    books: [{
      key: "examplebook",
      title: "Example Book",
      lastUpdate: "2026-09-10T12:00:00Z",
      awaySpread: -3.5,
      homeSpread: 3.5
    }]
  }]);
});

test("books without complete spread outcomes are ignored", () => {
  const games = normalizeNflSpreads([{
    id: "game-2",
    away_team: "Away",
    home_team: "Home",
    bookmakers: [{ key: "bad", title: "Bad", markets: [{ key: "spreads", outcomes: [{ name: "Away", point: -3 }] }] }]
  }]);
  assert.equal(games[0].bookmakerCount, 0);
  assert.deepEqual(games[0].books, []);
});

test("score response maps team scores and completion state", () => {
  const games = normalizeNflScores([{
    id: "game-3",
    sport_key: "americanfootball_nfl",
    commence_time: "2026-09-13T17:00:00Z",
    away_team: "Away Team",
    home_team: "Home Team",
    completed: true,
    last_update: "2026-09-13T20:15:00Z",
    scores: [
      { name: "Home Team", score: "20" },
      { name: "Away Team", score: "24" }
    ]
  }]);

  assert.deepEqual(games[0], {
    id: "game-3",
    sportKey: "americanfootball_nfl",
    commenceTime: "2026-09-13T17:00:00Z",
    awayTeam: "Away Team",
    homeTeam: "Home Team",
    completed: true,
    awayScore: 24,
    homeScore: 20,
    lastUpdate: "2026-09-13T20:15:00Z"
  });
});

test("upcoming score events keep missing scores as null", () => {
  const [game] = normalizeNflScores([{
    id: "game-4",
    away_team: "Away",
    home_team: "Home",
    completed: false,
    scores: null
  }]);

  assert.equal(game.completed, false);
  assert.equal(game.awayScore, null);
  assert.equal(game.homeScore, null);
});
