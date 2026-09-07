import test from "node:test";
import assert from "node:assert/strict";
import { storeFutureSurvivorMarkets } from "../src/ingestion.js";

function captureDb() {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      const text = String(sql);
      return {
        bind(...args) {
          return {
            async run() {
              if (text.includes("INSERT INTO survivor_future_markets")) writes.push(args);
              return { success: true };
            },
            async all() { return { results: [] }; },
            async first() { return null; }
          };
        },
        async run() { return { success: true }; },
        async all() { return { results: [] }; },
        async first() { return null; }
      };
    }
  };
}

function game(id, commenceTime, awayTeam, homeTeam) {
  return {
    id,
    commenceTime,
    awayTeam,
    homeTeam,
    books: [
      { key: "book1", awayMoneyline: -200, homeMoneyline: 170, awaySpread: -4, homeSpread: 4 },
      { key: "book2", awayMoneyline: -220, homeMoneyline: 180, awaySpread: -4.5, homeSpread: 4.5 }
    ]
  };
}

test("future Survivor markets reuse the existing odds payload and store only later weeks", async () => {
  const db = captureDb();
  const stored = await storeFutureSurvivorMarkets(db, [
    game("week1", "2026-09-10T00:00:00Z", "A", "B"),
    game("week2", "2026-09-17T00:00:00Z", "C", "D")
  ], { season: 2026, week: 1 }, new Date("2026-09-07T00:00:00Z"));

  assert.equal(stored, 1);
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0][1], 2);
  assert.equal(db.writes[0][2], "week2");
  assert.equal(db.writes[0][3], "C");
  assert.equal(db.writes[0][4], "D");
  assert.ok(Number(db.writes[0][8]) > 50);
});

test("future Survivor persistence limits strategy horizon to five weeks", async () => {
  const db = captureDb();
  const stored = await storeFutureSurvivorMarkets(db, [
    game("week7", "2026-10-22T00:00:00Z", "A", "B")
  ], { season: 2026, week: 1 }, new Date("2026-09-07T00:00:00Z"));
  assert.equal(stored, 0);
  assert.equal(db.writes.length, 0);
});
