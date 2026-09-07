import test from "node:test";
import assert from "node:assert/strict";
import { survivorRecommendations } from "../src/survivor.js";

function fakeDb() {
  const games = [{
    id: "g1", season: 2026, week: 2, season_type: "REGULAR",
    away_team: "Buffalo Bills", home_team: "Miami Dolphins",
    kickoff_at: "2026-09-13T17:00:00Z", status: "SCHEDULED"
  }];

  return {
    prepare(sql) {
      const text = String(sql);
      return {
        bind(...args) {
          return {
            async all() {
              if (text.includes("FROM games") && text.includes("season = ? AND week = ?")) return { results: games };
              if (text.includes("FROM survivor_picks")) return { results: [{ team: "Buffalo Bills" }] };
              if (text.includes("FROM moneyline_snapshots")) {
                return { results: [
                  { source: "book1", away_moneyline: -300, home_moneyline: 240, captured_at: "2026-09-07T10:00:00Z" },
                  { source: "book2", away_moneyline: -280, home_moneyline: 230, captured_at: "2026-09-07T10:00:00Z" }
                ] };
              }
              return { results: [] };
            },
            async run() { return { success: true }; }
          };
        },
        async run() { return { success: true }; },
        async all() { return { results: [] }; }
      };
    }
  };
}

test("Survivor removes a team already used by the selected entry", async () => {
  const result = await survivorRecommendations(fakeDb(), 2026, 2, 1);
  assert.deepEqual(result.usedTeams, ["Buffalo Bills"]);
  assert.equal(result.candidates.some((candidate) => candidate.team === "Buffalo Bills"), false);
  assert.equal(result.safestPick.team, "Miami Dolphins");
  assert.equal(result.strategyVersion, "safety_first_v1");
});
