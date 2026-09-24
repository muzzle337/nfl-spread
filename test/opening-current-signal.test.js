import test from "node:test";
import assert from "node:assert/strict";
import { openingSignalForGame } from "../src/weekly-picks.js";

const stats={buckets:{
  "AwayFav|<=3":{classification:"AwayFav",tier:"<=3",wins:4,losses:1,pushes:0,decisions:5,coverRate:80},
  "HomeDog|<=3":{classification:"HomeDog",tier:"<=3",wins:1,losses:4,pushes:0,decisions:5,coverRate:20},
  "AwayFav|<=7":{classification:"AwayFav",tier:"<=7",wins:1,losses:2,pushes:0,decisions:3,coverRate:33.3},
  "HomeDog|<=7":{classification:"HomeDog",tier:"<=7",wins:2,losses:1,pushes:0,decisions:3,coverRate:66.7}
}};

test("opening signal remains in the original tier after the current line crosses a boundary",()=>{
  const game={id:"bal-dal",awayTeam:"Baltimore Ravens",homeTeam:"Dallas Cowboys",medianAwaySpread:-3.5,medianHomeSpread:3.5};
  const movement={firstCapturedAwaySpread:-3,moneyline:{openingAwayMoneyline:-155,openingHomeMoneyline:135,openingAwayNoVigProbability:59.3,openingHomeNoVigProbability:40.7}};
  const opening=openingSignalForGame(game,movement,stats,{focusMin:55,gradeAMin:70,gradeBMin:60});
  assert.equal(opening.spread.away,-3);
  assert.equal(opening.classification.tier,"<=3");
  assert.equal(opening.projectedTeam,"Baltimore Ravens");
  assert.equal(opening.coverRate,80);
  assert.equal(opening.grade,"A");
  assert.deepEqual(opening.record,{classification:"AwayFav",tier:"<=3",wins:4,losses:1,pushes:0,decisions:5,coverRate:80});
});

test("opening signal is unavailable without a stored first pregame spread",()=>{
  assert.equal(openingSignalForGame({awayTeam:"A",homeTeam:"B"},null,stats,{}),null);
});
