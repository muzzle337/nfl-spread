import test from "node:test";
import assert from "node:assert/strict";
import { isPregameSnapshot, reconcileGamePregameMarkets, summarizePregameSpreadRows } from "../src/pregame-markets.js";

test("pregame boundary is strict and rejects invalid timestamps",()=>{
  assert.equal(isPregameSnapshot("2026-09-20T16:59:59Z","2026-09-20T17:00:00Z"),true);
  assert.equal(isPregameSnapshot("2026-09-20T17:00:00Z","2026-09-20T17:00:00Z"),false);
  assert.equal(isPregameSnapshot("2026-09-20T17:00:01Z","2026-09-20T17:00:00Z"),false);
  assert.equal(isPregameSnapshot("invalid","2026-09-20T17:00:00Z"),false);
});

test("opening and closing consensus use each book's first and last valid pregame row",()=>{
  const result=summarizePregameSpreadRows([
    {id:1,source:"a",away_spread:-1},
    {id:2,source:"b",away_spread:-1.5},
    {id:3,source:"a",away_spread:-2.5},
    {id:4,source:"b",away_spread:-2.5}
  ]);
  assert.equal(result.openingAwaySpread,-1);
  assert.equal(result.latestAwaySpread,-2.5);
  assert.equal(result.bookmakerCount,2);
  assert.equal(result.snapshotCount,4);
});

test("reconciliation replaces a contaminated close with the last pre-kickoff consensus",async()=>{
  const updates=[];
  const game={id:"g1",status:"COMPLETED",kickoff_at:"2026-09-20T17:00:00Z",opening_away_spread:-1,current_away_spread:-17.5,closing_away_spread:-17.5};
  const rows=[
    {id:1,source:"a",away_spread:-1,captured_at:"2026-09-15T12:00:00Z"},
    {id:2,source:"b",away_spread:-1.5,captured_at:"2026-09-15T12:01:00Z"},
    {id:3,source:"a",away_spread:-2.5,captured_at:"2026-09-20T16:55:00Z"},
    {id:4,source:"b",away_spread:-2.5,captured_at:"2026-09-20T16:56:00Z"}
  ];
  const db={prepare(sql){const normalized=sql.replace(/\s+/g," ").trim();return {bind(...args){return {
    async first(){if(normalized.startsWith("SELECT id,status"))return game;throw new Error(normalized)},
    async all(){if(normalized.startsWith("SELECT id,source"))return {results:rows};throw new Error(normalized)},
    async run(){if(normalized.startsWith("UPDATE games")){updates.push(args);return {}}throw new Error(normalized)}
  }}}}};
  const result=await reconcileGamePregameMarkets(db,"g1");
  assert.equal(result.openingAwaySpread,-1);
  assert.equal(result.closingAwaySpread,-2.5);
  assert.deepEqual(updates[0],[-1,-2.5,-2.5,"g1"]);
});
