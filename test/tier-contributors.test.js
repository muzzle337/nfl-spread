import test from "node:test";
import assert from "node:assert/strict";
import { seasonTierPulse, tierContributors } from "../src/tier-contributors.js";

function dbWith(rows) {
  return { prepare() { return { bind() { return { async all() { return { results: rows }; } }; } }; } };
}

test("tier contributors reconcile every win, loss and push to the displayed rate", async () => {
  const rows = [
    { id:"g1",week:1,away_team:"BUF",home_team:"HOU",away_score:24,home_score:20,away_spread:2.5,kickoff_at:"2026-09-13T17:00:00Z" },
    { id:"g2",week:1,away_team:"DEN",home_team:"KC",away_score:20,home_score:24,away_spread:2.5,kickoff_at:"2026-09-13T20:00:00Z" },
    { id:"g3",week:2,away_team:"NYJ",home_team:"NE",away_score:20,home_score:23,away_spread:3,kickoff_at:"2026-09-20T17:00:00Z" },
    { id:"other",week:2,away_team:"SF",home_team:"LAR",away_score:10,home_score:20,away_spread:-3.5,kickoff_at:"2026-09-20T20:00:00Z" }
  ];
  const result = await tierContributors(dbWith(rows), 2026, "HomeFav", "<=3");
  assert.equal(result.games.length, 3);
  assert.deepEqual(result.games.map((game) => game.outcome), ["LOSS", "WIN", "PUSH"]);
  assert.deepEqual({ wins:result.wins,losses:result.losses,pushes:result.pushes,decisions:result.decisions,coverRate:result.coverRate }, { wins:1,losses:1,pushes:1,decisions:2,coverRate:50 });
  assert.deepEqual(result.momentum.map((row) => ({ week:row.week,weekly:row.weekly.coverRate,cumulative:row.cumulative.coverRate })), [
    { week:1,weekly:50,cumulative:50 },
    { week:2,weekly:null,cumulative:50 }
  ]);
});

test("season pulse always includes every completed week independently of the viewed week", async () => {
  const rows = [
    { id:"g1",week:1,away_team:"BUF",home_team:"HOU",away_score:24,home_score:20,away_spread:2.5,kickoff_at:"2026-09-13T17:00:00Z" },
    { id:"g2",week:2,away_team:"NYJ",home_team:"NE",away_score:10,home_score:21,away_spread:2.5,kickoff_at:"2026-09-20T17:00:00Z" }
  ];
  const result = await seasonTierPulse(dbWith(rows),2026);
  assert.equal(result.throughWeek,2);
  assert.equal(result.gamesConsidered,2);
  assert.deepEqual(result.buckets["HomeFav|<=3"],{
    classification:"HomeFav",tier:"<=3",wins:1,losses:1,pushes:0,decisions:2,coverRate:50
  });
  assert.deepEqual(result.momentum["HomeFav|<=3"].map((row)=>row.week),[1,2]);
});
