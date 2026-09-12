import test from "node:test";
import assert from "node:assert/strict";
import { finalFromNflverseRow, repairMissingFinalsFromNflverse } from "../src/stale-results-repair.js";

function fakeDb(games) {
  const state = new Map(games.map((game) => [game.id, { ...game }]));
  return {
    state,
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        bind(...args) {
          return {
            async first() {
              if (normalized.startsWith("SELECT id, status")) return state.get(args[0]) ?? null;
              throw new Error(`Unexpected first query: ${normalized}`);
            },
            async all() {
              if (normalized.startsWith("SELECT away_spread")) return { results: [{ away_spread: 3 }] };
              throw new Error(`Unexpected all query: ${normalized}`);
            },
            async run() {
              if (!normalized.startsWith("UPDATE games")) throw new Error(`Unexpected run query: ${normalized}`);
              const [awayScore, homeScore, closingAwaySpread, gameId] = args;
              const game = state.get(gameId);
              game.away_score = awayScore;
              game.home_score = homeScore;
              game.status = "COMPLETED";
              game.closing_away_spread = game.closing_away_spread ?? closingAwaySpread;
              state.set(gameId, game);
              return { success: true };
            }
          };
        }
      };
    }
  };
}

test("nflverse final normalization matches NE at SEA and preserves stored game id", () => {
  const stored = {
    id: "odds-ne-sea",
    away_team: "New England Patriots",
    home_team: "Seattle Seahawks",
    kickoff_at: "2026-09-10T00:20:00Z"
  };
  const result = finalFromNflverseRow({ away_team: "NE", home_team: "SEA", away_score: "10", home_score: "13" }, stored);
  assert.deepEqual(result, {
    id: "odds-ne-sea",
    completed: true,
    awayTeam: "New England Patriots",
    homeTeam: "Seattle Seahawks",
    commenceTime: "2026-09-10T00:20:00Z",
    awayScore: 10,
    homeScore: 13,
    source: "nflverse"
  });
});

test("nflverse LA abbreviation maps to stored Los Angeles Rams", () => {
  const stored = {
    id: "odds-sf-lar",
    away_team: "San Francisco 49ers",
    home_team: "Los Angeles Rams",
    kickoff_at: "2026-09-11T00:35:00Z"
  };
  const result = finalFromNflverseRow({ away_team: "SF", home_team: "LA", away_score: "27", home_score: "7" }, stored);
  assert.equal(result.awayScore, 27);
  assert.equal(result.homeScore, 7);
});

test("stale repair writes both known Week 1 finals without using provider ids", async () => {
  const games = [
    {
      id: "provider-ne-sea",
      season: 2026,
      week: 1,
      away_team: "New England Patriots",
      home_team: "Seattle Seahawks",
      kickoff_at: "2026-09-10T00:20:00Z",
      status: "SCHEDULED",
      away_score: null,
      home_score: null,
      closing_away_spread: null
    },
    {
      id: "provider-sf-lar",
      season: 2026,
      week: 1,
      away_team: "San Francisco 49ers",
      home_team: "Los Angeles Rams",
      kickoff_at: "2026-09-11T00:35:00Z",
      status: "SCHEDULED",
      away_score: null,
      home_score: null,
      closing_away_spread: null
    }
  ];
  const db = fakeDb(games);
  const result = await repairMissingFinalsFromNflverse({
    db,
    missingGames: games,
    fetchWeek: async () => [
      { season: 2026, week: 1, away_team: "NE", home_team: "SEA", away_score: "10", home_score: "13" },
      { season: 2026, week: 1, away_team: "SF", home_team: "LA", away_score: "27", home_score: "7" }
    ]
  });

  assert.equal(result.repaired, 2);
  assert.equal(result.unresolved, 0);
  assert.equal(db.state.get("provider-ne-sea").status, "COMPLETED");
  assert.equal(db.state.get("provider-ne-sea").away_score, 10);
  assert.equal(db.state.get("provider-ne-sea").home_score, 13);
  assert.equal(db.state.get("provider-sf-lar").away_score, 27);
  assert.equal(db.state.get("provider-sf-lar").home_score, 7);
});
