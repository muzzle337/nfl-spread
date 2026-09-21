import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateSignalPerformance,
  capturePregameSignalSnapshots,
  gradeSignalRows,
  signalSnapshotForGame
} from "../src/signal-performance.js";

function payload(overrides={}) {
  return {
    gameId:"g1",awayTeam:"BUF",homeTeam:"HOU",kickoffAt:"2026-09-18T00:15:00Z",
    projectedTeam:"BUF",projectedClassification:"AwayFav",tier:"<=3",coverRate:75,grade:"A",
    spread:{away:-2.5,home:2.5},
    market:{alignment:"ALIGNED",movementTeam:"BUF"},
    historical:{supports:1,conflicts:0},situational:{supports:1,conflicts:0},
    outrightTeam:"BUF",...overrides
  };
}

function stored(id,week,snapshot,overrides={}) {
  return {
    game_id:id,season:2026,week,kickoff_at:snapshot.kickoffAt,
    payload_json:JSON.stringify(snapshot),captured_at:"2026-09-17T12:00:00Z",
    away_team:snapshot.awayTeam,home_team:snapshot.homeTeam,status:"COMPLETED",
    away_score:24,home_score:20,away_spread:-2.5,...overrides
  };
}

test("snapshot records the displayed pregame thesis without postgame fields",()=>{
  const snapshot=signalSnapshotForGame({
    gameId:"g1",awayTeam:"BUF",homeTeam:"HOU",kickoffAt:"2026-09-18T00:15:00Z",
    classification:{away:"AwayFav",home:"HomeDog",tier:"<=3"},
    spread:{away:-2.5,home:2.5,projectedTeam:"BUF",coverRate:75,grade:"A"},
    movement:{direction:"TOWARD_AWAY",marketAlignment:"ALIGNED"},
    history:{evidenceSummary:{supports:2,conflicts:1},situationalSummary:{supports:1,conflicts:1}},
    outlook:{team:"BUF"},final:{awayScore:24,homeScore:20}
  });
  assert.deepEqual(snapshot.market,{alignment:"ALIGNED",movementTeam:"BUF",awayMoneyline:null,homeMoneyline:null,awayWinPct:null,homeWinPct:null});
  assert.equal(snapshot.projectedClassification,"AwayFav");
  assert.equal(snapshot.historical.supports,2);
  assert.equal(snapshot.situational.supports,1);
  assert.equal(snapshot.outrightTeam,"BUF");
  assert.equal("final" in snapshot,false);
});

test("capture updates future snapshots but never rewrites a game after kickoff",async()=>{
  const writes=[];
  const db={prepare(sql){return {
    async run(){return {}},
    bind(...args){return {async run(){writes.push({sql,args});return {}}}}
  }}};
  const future={...payload(),gameId:"future",kickoffAt:"2026-09-18T00:15:00Z"};
  const started={...payload(),gameId:"started",kickoffAt:"2026-09-17T00:15:00Z"};
  const result=await capturePregameSignalSnapshots(db,2026,2,[future,started],new Date("2026-09-17T12:00:00Z"));
  assert.deepEqual(result,{captured:1,skippedStarted:1,skippedEmpty:0});
  assert.equal(writes.length,1);
  assert.equal(writes[0].args[0],"future");
});

test("ATS and outright signals are graded separately from the frozen snapshot",()=>{
  const first=payload();
  const second=payload({
    gameId:"g2",awayTeam:"DEN",homeTeam:"KC",projectedTeam:"DEN",projectedClassification:"AwayDog",
    spread:{away:3,home:-3},market:{alignment:"DIVERGENT",movementTeam:"KC"},
    historical:{supports:1,conflicts:1},situational:{supports:0,conflicts:1},outrightTeam:"KC"
  });
  const pending=payload({gameId:"g3",awayTeam:"NYG",homeTeam:"LAR",projectedTeam:"NYG",market:{alignment:"ALIGNED",movementTeam:"NYG"},outrightTeam:"LAR"});
  const graded=gradeSignalRows([
    stored("g1",1,first,{away_spread:-10}),
    stored("g2",1,second,{away_team:"DEN",home_team:"KC",away_score:20,home_score:24,away_spread:3}),
    stored("g3",2,pending,{away_team:"NYG",home_team:"LAR",status:"SCHEDULED",away_score:null,home_score:null,away_spread:7})
  ]);
  const result=aggregateSignalPerformance(graded);
  const byId=Object.fromEntries(result.signals.map((row)=>[row.id,row]));
  assert.deepEqual(
    {wins:byId.TIER_EDGE.wins,losses:byId.TIER_EDGE.losses,pending:byId.TIER_EDGE.pending,metric:byId.TIER_EDGE.metric},
    {wins:1,losses:1,pending:1,metric:"ATS"}
  );
  assert.deepEqual(
    {wins:byId.MARKET_ALIGNED.wins,losses:byId.MARKET_ALIGNED.losses,pending:byId.MARKET_ALIGNED.pending},
    {wins:1,losses:0,pending:1}
  );
  assert.deepEqual(
    {wins:byId.SITUATIONAL_SUPPORT.wins,losses:byId.SITUATIONAL_SUPPORT.losses,pending:byId.SITUATIONAL_SUPPORT.pending,metric:byId.SITUATIONAL_SUPPORT.metric},
    {wins:1,losses:0,pending:1,metric:"OUTRIGHT"}
  );
  assert.deepEqual(
    {wins:byId.OUTRIGHT_OUTLOOK.wins,losses:byId.OUTRIGHT_OUTLOOK.losses,pending:byId.OUTRIGHT_OUTLOOK.pending},
    {wins:2,losses:0,pending:1}
  );
  assert.equal(byId.TIER_EDGE.weeks.length,2);
});

test("unsupported drilldown signals are rejected",()=>{
  assert.throws(()=>aggregateSignalPerformance([],"MADE_UP"),/Unsupported signal/);
});
