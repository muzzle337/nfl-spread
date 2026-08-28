import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  spreadRefreshIntervalHours,
  spreadRefreshStatus,
  syncSpreadsIfDue
} from "../src/spread-sync.js";

function fakeDb({ games = [], lastRefreshAt = null } = {}) {
  return {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      const latestKnown = () => games
        .filter((game) => game.season_type === "REGULAR")
        .sort((a, b) => new Date(b.kickoff_at) - new Date(a.kickoff_at))[0] ?? null;

      return {
        async first() {
          if (normalized.includes("ORDER BY julianday(kickoff_at) DESC")) return latestKnown();
          throw new Error(`Unexpected direct first query: ${normalized}`);
        },
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
              throw new Error(`Unexpected bound first query: ${normalized}`);
            }
          };
        },
        async firstUsage() {
          return null;
        },
        async run() {
          throw new Error(`Unexpected run query: ${normalized}`);
        }
      };
    },
    __lastRefreshAt: lastRefreshAt
  };
}

function dbWithUsage({ games = [], lastRefreshAt = null } = {}) {
  const base = fakeDb({ games, lastRefreshAt });
  const originalPrepare = base.prepare.bind(base);
  base.prepare = (sql) => {
    const normalized = sql.replace(/\s+/g, " ").trim();
    if (normalized.startsWith("SELECT request_type")) {
      return {
        async first() {
          return lastRefreshAt ? {
            request_type: "nfl_auto_spreads",
            requested_at_iso: lastRefreshAt
          } : null;
        }
      };
    }
    return originalPrepare(sql);
  };
  return base;
}

function game(kickoffAt, { id = "g1", status = "SCHEDULED", week = 1 } = {}) {
  return {
    id,
    season: 2026,
    week,
    season_type: "REGULAR",
    away_team: "Buffalo Bills",
    home_team: "Houston Texans",
    kickoff_at: kickoffAt,
    status
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
  const db = dbWithUsage({
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
  const db = dbWithUsage({
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
  const db = dbWithUsage({
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

test("after the last known kickoff, the guard can discover the next week once per day", async () => {
  const db = dbWithUsage({
    games: [game("2026-09-08T00:00:00Z", { status: "SCHEDULED" })],
    lastRefreshAt: "2026-09-08T01:00:00Z"
  });
  let calls = 0;

  const result = await syncSpreadsIfDue({
    db,
    apiKey: "test-key",
    now: new Date("2026-09-09T02:00:00Z"),
    fetchSpreads: async () => {
      calls += 1;
      return { quota: { creditsUsedThisRequest: 1 }, games: [] };
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.apiCalled, true);
  assert.equal(result.reason, "DISCOVER_NEXT_WEEK");
  assert.equal(result.status.discoveryMode, true);
  assert.equal(result.status.refreshIntervalHours, 24);
});

test("an empty database does not trigger automatic paid discovery", async () => {
  const db = dbWithUsage({ games: [] });
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
  assert.equal(result.reason, "NO_STORED_GAMES");
});

test("Cloudflare runs an hourly D1 guard for spreads while preserving the daily results cron", () => {
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(config, /"35 \* \* \* \*"/);
  assert.match(config, /"15 12 \* \* \*"/);
});
