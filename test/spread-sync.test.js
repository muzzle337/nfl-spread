import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SPREAD_REFRESH_CRON,
  spreadRefreshIntervalHours,
  spreadRefreshStatus,
  syncSpreadsIfDue
} from "../src/spread-sync.js";

function fakeDb({ games = [], lastRefreshAt = null } = {}) {
  return {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        bind(...args) {
          return {
            async first() {
              if (normalized.startsWith("SELECT id, season, week, away_team")) {
                const nowMs = new Date(args[0]).getTime();
                return games
                  .filter((game) => game.season_type === "REGULAR")
                  .filter((game) => game.status !== "COMPLETED")
                  .filter((game) => new Date(game.kickoff_at).getTime() > nowMs)
                  .sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))[0] ?? null;
              }

              if (normalized.startsWith("SELECT request_type")) {
                return lastRefreshAt ? {
                  request_type: "nfl_auto_spreads",
                  requested_at_iso: lastRefreshAt
                } : null;
              }

              throw new Error(`Unexpected first query: ${normalized}`);
            }
          };
        }
      };
    }
  };
}

function game(kickoffAt) {
  return {
    id: "g1",
    season: 2026,
    week: 1,
    season_type: "REGULAR",
    away_team: "Buffalo Bills",
    home_team: "Houston Texans",
    kickoff_at: kickoffAt,
    status: "SCHEDULED"
  };
}

test("spread refresh interval tightens as kickoff approaches", () => {
  assert.equal(spreadRefreshIntervalHours(120), 24);
  assert.equal(spreadRefreshIntervalHours(72), 12);
  assert.equal(spreadRefreshIntervalHours(48), 12);
  assert.equal(spreadRefreshIntervalHours(24), 6);
  assert.equal(spreadRefreshIntervalHours(12), 6);
  assert.equal(spreadRefreshIntervalHours(6), 2);
  assert.equal(spreadRefreshIntervalHours(1), 2);
  assert.equal(spreadRefreshIntervalHours(-1), null);
});

test("spread status uses zero-credit D1 data and stays fresh when interval has not elapsed", async () => {
  const db = fakeDb({
    games: [game("2026-09-10T20:00:00Z")],
    lastRefreshAt: "2026-09-08T08:00:00Z"
  });

  const status = await spreadRefreshStatus(db, new Date("2026-09-08T12:00:00Z"));
  assert.equal(status.hoursToKickoff, 56);
  assert.equal(status.refreshIntervalHours, 12);
  assert.equal(status.hoursSinceRefresh, 4);
  assert.equal(status.due, false);
  assert.equal(status.reason, "FRESH_ENOUGH");
});

test("guarded spread sync does not call the provider when the market is still fresh", async () => {
  const db = fakeDb({
    games: [game("2026-09-10T20:00:00Z")],
    lastRefreshAt: "2026-09-08T08:00:00Z"
  });
  let calls = 0;

  const result = await syncSpreadsIfDue({
    db,
    apiKey: "test-key",
    now: new Date("2026-09-08T12:00:00Z"),
    fetchSpreads: async () => {
      calls += 1;
      throw new Error("provider should not be called");
    }
  });

  assert.equal(calls, 0);
  assert.equal(result.apiCalled, false);
  assert.equal(result.reason, "FRESH_ENOUGH");
  assert.equal(result.quota, null);
});

test("guarded spread sync calls the provider once when the adaptive interval is due", async () => {
  const db = fakeDb({
    games: [game("2026-09-08T16:00:00Z")],
    lastRefreshAt: "2026-09-08T10:00:00Z"
  });
  let calls = 0;

  const result = await syncSpreadsIfDue({
    db,
    apiKey: "test-key",
    now: new Date("2026-09-08T12:00:00Z"),
    fetchSpreads: async ({ apiKey }) => {
      calls += 1;
      assert.equal(apiKey, "test-key");
      return {
        quota: { creditsUsedThisRequest: 1, creditsRemaining: 490 },
        games: []
      };
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.apiCalled, true);
  assert.equal(result.reason, "REFRESH_DUE");
  assert.equal(result.status.refreshIntervalHours, 2);
  assert.equal(result.ingestion.gamesSelected, 0);
});

test("no upcoming games means no automatic paid spread call", async () => {
  const db = fakeDb({ games: [] });
  let calls = 0;

  const result = await syncSpreadsIfDue({
    db,
    apiKey: "test-key",
    now: new Date("2026-09-08T12:00:00Z"),
    fetchSpreads: async () => {
      calls += 1;
      return { quota: {}, games: [] };
    }
  });

  assert.equal(calls, 0);
  assert.equal(result.apiCalled, false);
  assert.equal(result.reason, "NO_UPCOMING_GAMES");
});

test("Cloudflare runs an hourly D1 guard for spreads while preserving the daily results cron", () => {
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(config, new RegExp(`"${SPREAD_REFRESH_CRON.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  assert.match(config, /"15 12 \* \* \*"/);
});
