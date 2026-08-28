import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  partitionMissingFinals,
  syncResultsIfDue,
  weekResultsStatus
} from "../src/result-sync.js";

function fakeDb({ games = [], spreadsById = {} } = {}) {
  const state = new Map(games.map((game) => [game.id, { ...game }]));

  return {
    state,
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        bind(...args) {
          return {
            async all() {
              if (normalized.startsWith("SELECT id, season, week")) {
                const cutoffMs = new Date(args[0]).getTime();
                const results = [...state.values()]
                  .filter((game) => game.season_type === "REGULAR")
                  .filter((game) => new Date(game.kickoff_at).getTime() <= cutoffMs)
                  .filter((game) => game.status !== "COMPLETED" || game.away_score == null || game.home_score == null)
                  .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));
                return { results };
              }

              if (normalized.startsWith("SELECT id, away_team, home_team")) {
                const [season, week] = args.map(Number);
                const results = [...state.values()]
                  .filter((game) => Number(game.season) === season && Number(game.week) === week && game.season_type === "REGULAR")
                  .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at));
                return { results };
              }

              if (normalized.startsWith("SELECT away_spread")) {
                const [gameId] = args;
                return { results: (spreadsById[gameId] ?? []).map((away_spread) => ({ away_spread })) };
              }

              throw new Error(`Unexpected all query: ${normalized}`);
            },

            async first() {
              if (normalized.startsWith("SELECT id, status")) {
                return state.get(args[0]) ?? null;
              }
              throw new Error(`Unexpected first query: ${normalized}`);
            },

            async run() {
              if (normalized.startsWith("UPDATE games")) {
                const [awayScore, homeScore, closingAwaySpread, gameId] = args;
                const game = state.get(gameId);
                if (!game) return { success: true };
                game.away_score = awayScore;
                game.home_score = homeScore;
                game.status = "COMPLETED";
                if (game.closing_away_spread == null) game.closing_away_spread = closingAwaySpread;
                state.set(gameId, game);
                return { success: true };
              }
              throw new Error(`Unexpected run query: ${normalized}`);
            }
          };
        }
      };
    }
  };
}

const scheduledGame = ({
  id,
  kickoffAt,
  status = "SCHEDULED",
  awayScore = null,
  homeScore = null,
  season = 2026,
  week = 1
}) => ({
  id,
  season,
  week,
  season_type: "REGULAR",
  away_team: `Away ${id}`,
  home_team: `Home ${id}`,
  kickoff_at: kickoffAt,
  status,
  away_score: awayScore,
  home_score: homeScore,
  closing_away_spread: null
});

test("3-day partition keeps recent missing finals eligible and marks older gaps for attention", () => {
  const now = new Date("2026-09-15T12:15:00Z");
  const recent = { id: "recent", kickoff_at: "2026-09-13T20:25:00Z" };
  const stale = { id: "stale", kickoff_at: "2026-09-10T00:15:00Z" };

  const result = partitionMissingFinals([recent, stale], now, 3);
  assert.deepEqual(result.eligibleForAutoSync.map((game) => game.id), ["recent"]);
  assert.deepEqual(result.staleMissing.map((game) => game.id), ["stale"]);
});

test("guarded sync uses zero API credits when no final is due", async () => {
  const db = fakeDb({
    games: [scheduledGame({ id: "future", kickoffAt: "2026-09-16T00:15:00Z" })]
  });
  let calls = 0;

  const result = await syncResultsIfDue({
    db,
    apiKey: "test-key",
    now: new Date("2026-09-15T12:15:00Z"),
    fetchScores: async () => {
      calls += 1;
      throw new Error("should not call provider");
    }
  });

  assert.equal(calls, 0);
  assert.equal(result.apiCalled, false);
  assert.equal(result.reason, "NO_RESULTS_DUE");
  assert.equal(result.quota, null);
});

test("guarded sync calls the 3-day score feed when a recently finished game lacks a final", async () => {
  const db = fakeDb({
    games: [scheduledGame({ id: "g1", kickoffAt: "2026-09-14T00:20:00Z" })],
    spreadsById: { g1: [-3, -3, -2.5, -3, -2.5] }
  });
  let calls = 0;

  const result = await syncResultsIfDue({
    db,
    apiKey: "test-key",
    now: new Date("2026-09-14T12:15:00Z"),
    fetchScores: async ({ apiKey, daysFrom }) => {
      calls += 1;
      assert.equal(apiKey, "test-key");
      assert.equal(daysFrom, 3);
      return {
        quota: { creditsUsedThisRequest: 2, creditsRemaining: 495 },
        games: [{
          id: "g1",
          completed: true,
          awayTeam: "Away g1",
          homeTeam: "Home g1",
          awayScore: 24,
          homeScore: 20
        }]
      };
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.apiCalled, true);
  assert.equal(result.ingestion.gamesUpdated, 1);
  assert.equal(result.integrityAfter.missingCount, 0);
  assert.equal(db.state.get("g1").status, "COMPLETED");
  assert.equal(db.state.get("g1").away_score, 24);
  assert.equal(db.state.get("g1").home_score, 20);
  assert.equal(db.state.get("g1").closing_away_spread, -3);
});

test("stale missing finals outside the provider lookback do not trigger repeated paid calls", async () => {
  const db = fakeDb({
    games: [scheduledGame({ id: "old", kickoffAt: "2026-09-10T00:15:00Z" })]
  });
  let calls = 0;

  const result = await syncResultsIfDue({
    db,
    apiKey: "test-key",
    now: new Date("2026-09-15T12:15:00Z"),
    fetchScores: async () => {
      calls += 1;
      return { quota: {}, games: [] };
    }
  });

  assert.equal(calls, 0);
  assert.equal(result.apiCalled, false);
  assert.equal(result.reason, "MISSING_OUTSIDE_SCORE_LOOKBACK");
  assert.equal(result.integrityBefore.staleMissingCount, 1);
});

test("weekly results status distinguishes completed, awaiting, and overdue missing finals", async () => {
  const db = fakeDb({
    games: [
      scheduledGame({
        id: "done",
        kickoffAt: "2026-09-13T17:00:00Z",
        status: "COMPLETED",
        awayScore: 27,
        homeScore: 20
      }),
      scheduledGame({ id: "missing", kickoffAt: "2026-09-13T20:25:00Z" }),
      scheduledGame({ id: "future", kickoffAt: "2026-09-15T00:15:00Z" })
    ]
  });

  const status = await weekResultsStatus(db, 2026, 1, new Date("2026-09-14T12:15:00Z"));
  assert.equal(status.totalGames, 3);
  assert.equal(status.completedGames, 1);
  assert.equal(status.awaitingCompletion, 1);
  assert.equal(status.missingFinals, 1);
  assert.equal(status.weekComplete, false);
  assert.equal(status.missing[0].id, "missing");
});

test("Cloudflare cron keeps the guarded results check once daily at 12:15 UTC", () => {
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(config, /"15 12 \* \* \*"/);
});
