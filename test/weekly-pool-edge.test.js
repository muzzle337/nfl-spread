import test from "node:test";
import assert from "node:assert/strict";
import { poolWinEdge } from "../src/weekly-picks.js";

test("pool edge prioritizes outright moneyline probability and uses Brain as support",()=>{
  const edge=poolWinEdge({
    awayTeam:"A",homeTeam:"B",projectedTeam:"A",
    moneyline:{awayWinProbability:62,homeWinProbability:38}
  },{away:{notable:[{record:{winPct:70}}]},home:{notable:[]}},
  {direction:"TOWARD_AWAY"});
  assert.equal(edge.team,"A");
  assert.equal(edge.confidence,"SAFE FAVORITE");
  assert.equal(edge.leverage,"FIELD EDGE");
  assert.ok(edge.reasons.some(x=>x.includes("primary outright-win")));
});

test("pool edge stays separate from ATS when moneyline points the other way",()=>{
  const edge=poolWinEdge({
    awayTeam:"A",homeTeam:"B",projectedTeam:"A",
    moneyline:{awayWinProbability:44,homeWinProbability:56}
  },null,null);
  assert.equal(edge.team,"B");
  assert.equal(edge.confidence,"COIN FLIP");
});
