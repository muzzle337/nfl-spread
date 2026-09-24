import test from "node:test";
import assert from "node:assert/strict";
import { buildTrendWatch } from "../src/trend-watch.js";

const pulse = {
  buckets:{
    "AwayFav|<=3":{wins:4,losses:1,pushes:0,decisions:5,coverRate:80},
    "HomeDog|<=3":{wins:1,losses:4,pushes:0,decisions:5,coverRate:20},
    "AwayDog|>7":{wins:3,losses:2,pushes:0,decisions:5,coverRate:60},
    "HomeFav|>7":{wins:2,losses:3,pushes:0,decisions:5,coverRate:40},
    "AwayFav|<=7":{wins:1,losses:2,pushes:0,decisions:3,coverRate:33.3},
    "HomeDog|<=7":{wins:2,losses:1,pushes:0,decisions:3,coverRate:66.7}
  },
  momentum:{
    "AwayFav|<=3":[
      {week:1,weekly:{coverRate:75}},
      {week:2,weekly:{coverRate:100}}
    ],
    "AwayDog|>7":[
      {week:1,weekly:{coverRate:50}},
      {week:2,weekly:{coverRate:66.7}}
    ],
    "HomeDog|<=7":[{week:2,weekly:{coverRate:66.7}}]
  }
};

test("Trend Watch selects one winning side per complementary pair and exposes momentum",()=>{
  const games=[
    {id:"car-cle",awayTeam:"CAR",homeTeam:"CLE",classification:{away:"AwayFav",home:"HomeDog",tier:"<=3"}},
    {id:"lac-buf",awayTeam:"LAC",homeTeam:"BUF",classification:{away:"AwayDog",home:"HomeFav",tier:">7"}},
    {id:"bal-dal",awayTeam:"BAL",homeTeam:"DAL",classification:{away:"AwayFav",home:"HomeDog",tier:"<=7"}}
  ];
  const rows=buildTrendWatch(pulse,games);
  assert.deepEqual(rows.map((row)=>row.key),["AwayFav|<=3","HomeDog|<=7","AwayDog|>7"]);
  assert.equal(rows[0].oppositeClassification,"HomeDog");
  assert.equal(rows[0].momentum.status,"STRENGTHENING");
  assert.equal(rows[0].momentum.previousWeek,1);
  assert.equal(rows[0].momentum.currentWeek,2);
  assert.equal(rows[0].currentWeekMatchCount,1);
  assert.equal(rows[1].momentum.status,"NEW");
  assert.equal(rows[1].momentum.currentWeek,2);
  assert.equal(rows.some((row)=>row.key==="HomeDog|<=3"),false);
});

test("Trend Watch excludes pairs with no side at the established 55 percent threshold",()=>{
  const rows=buildTrendWatch({buckets:{
    "AwayDog|<=7":{wins:6,losses:6,decisions:12,coverRate:50},
    "HomeFav|<=7":{wins:6,losses:6,decisions:12,coverRate:50}
  },momentum:{}},[]);
  assert.deepEqual(rows,[]);
});
