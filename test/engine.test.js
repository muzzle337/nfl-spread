import test from "node:test";
import assert from "node:assert/strict";
import { classifyGame, focusGrade, settleAgainstSpread, tierForSpread } from "../src/engine.js";

test("tier boundaries", () => {
  assert.equal(tierForSpread(0), "PICK_EM");
  assert.equal(tierForSpread(-3), "<=3");
  assert.equal(tierForSpread(3.5), "<=7");
  assert.equal(tierForSpread(-7), "<=7");
  assert.equal(tierForSpread(7.5), ">7");
});

test("away favorite classification", () => {
  assert.deepEqual(classifyGame(-3.5, 3.5), { away: "AwayFav", home: "HomeDog", tier: "<=7" });
});

test("home favorite classification", () => {
  assert.deepEqual(classifyGame(3, -3), { away: "AwayDog", home: "HomeFav", tier: "<=3" });
});

test("rejects mismatched spreads", () => {
  assert.throws(() => classifyGame(-3.5, 4), /mismatch/);
});

test("favorite covers", () => {
  const result = settleAgainstSpread({ awaySpread: -3.5, homeSpread: 3.5, awayScore: 24, homeScore: 17 });
  assert.equal(result.result, "FAVORITE");
  assert.equal(result.coveringSide, "Away");
});

test("underdog covers despite favorite winning outright", () => {
  const result = settleAgainstSpread({ awaySpread: -10, homeSpread: 10, awayScore: 27, homeScore: 20 });
  assert.equal(result.result, "UNDERDOG");
  assert.equal(result.coveringSide, "Home");
});

test("push is retained", () => {
  const result = settleAgainstSpread({ awaySpread: -3, homeSpread: 3, awayScore: 20, homeScore: 17 });
  assert.equal(result.result, "PUSH");
});

test("focus grades", () => {
  assert.equal(focusGrade(70), "A");
  assert.equal(focusGrade(60), "B");
  assert.equal(focusGrade(55), "C");
  assert.equal(focusGrade(54.9), null);
});
