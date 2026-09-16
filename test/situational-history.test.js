import test from "node:test";
import assert from "node:assert/strict";
import snapshot from "../src/situational-history-data.json" with { type: "json" };
import { situationalEvidenceForGame, situationalSummary } from "../src/situational-history.js";
import { canonicalTeamCode, dedupeCanonicalMatchups } from "../src/team-codes.js";

test("bundled nflverse snapshot reconciles 2023-2025 situations and exact Seattle results", () => {
  assert.deepEqual(snapshot.timeframe, { fromSeason: 2023, toSeason: 2025 });
  assert.equal(snapshot.games, 816);
  assert.equal(Object.keys(snapshot.teams).length, 32);
  assert.deepEqual(snapshot.teams.SEA.trailingHalftime, { games:22, losses:12, ties:0, winPct:45.5, wins:10 });
  assert.equal(snapshot.league.trailingHalftime.winPct, 23.2);
  assert.equal(snapshot.teams.SEA.trailingHalftime.wins + snapshot.teams.SEA.trailingHalftime.losses, 22);
});

test("situational evidence is outright, baseline-aware, balanced by team, and capped at two", () => {
  const items = situationalEvidenceForGame({
    awayCode:"SEA", homeCode:"ARI", projectedCode:"SEA",
    classification:{ away:"AwayFav", home:"HomeDog", tier:"<=7" }
  }, snapshot);

  assert.equal(items.length, 2);
  assert.deepEqual(new Set(items.map((item)=>item.team)), new Set(["SEA","ARI"]));
  assert.ok(items.every((item)=>item.outcomeType === "OUTRIGHT"));
  assert.ok(items.every((item)=>item.games >= 5 && item.timeframe.fromSeason === 2023 && item.timeframe.toSeason === 2025));
  assert.ok(items.every((item)=>Number.isFinite(item.baseline.winPct)));
  assert.equal("grade" in items[0], false);
  assert.equal("probability" in items[0], false);
  const counts = situationalSummary(items);
  assert.equal(counts.supports + counts.conflicts + counts.neutral, 2);
});

test("canonical aliases suppress a blank LA schedule duplicate in favor of market-backed LAR", () => {
  assert.equal(canonicalTeamCode("LA"), "LAR");
  const games = dedupeCanonicalMatchups([
    { id:"schedule",season:2026,week:2,awayTeam:"NYG",homeTeam:"LA",bookmakerCount:0,status:"SCHEDULED" },
    { id:"market",season:2026,week:2,awayTeam:"New York Giants",homeTeam:"Los Angeles Rams",bookmakerCount:9,status:"SCHEDULED" }
  ]);
  assert.equal(games.length,1);
  assert.equal(games[0].id,"market");
});
