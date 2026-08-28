import test from "node:test";
import assert from "node:assert/strict";
import { resolveDashboardWeek } from "../src/dashboard-data.js";

function fakeDb({ season = 2026, weeks = [] } = {}) {
  return {
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim();
      return {
        bind() {
          return {
            async all() {
              if (normalized.includes("GROUP BY week")) return { results: weeks };
              throw new Error(`Unexpected all query: ${normalized}`);
            }
          };
        },
        async first() {
          if (normalized.startsWith("SELECT MAX(season)")) return { season };
          throw new Error(`Unexpected first query: ${normalized}`);
        }
      };
    }
  };
}

test("dashboard chooses the earliest stored week that is not fully completed", async () => {
  const db = fakeDb({ weeks: [
    { week: 1, total_games: 16, completed_games: 16 },
    { week: 2, total_games: 16, completed_games: 3 },
    { week: 3, total_games: 16, completed_games: 0 }
  ] });

  assert.deepEqual(await resolveDashboardWeek(db), { season: 2026, week: 2 });
});

test("dashboard stays on the latest stored week when every stored week is complete", async () => {
  const db = fakeDb({ weeks: [
    { week: 1, total_games: 16, completed_games: 16 },
    { week: 2, total_games: 16, completed_games: 16 }
  ] });

  assert.deepEqual(await resolveDashboardWeek(db), { season: 2026, week: 2 });
});

test("dashboard handles an empty database", async () => {
  const db = fakeDb({ season: null, weeks: [] });
  assert.deepEqual(await resolveDashboardWeek(db), { season: null, week: null });
});
