import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCanonicalWeeklyPayload, compareWeeklyParity, READ_BUDGET } from '../src/weekly-intelligence.js';

function game(overrides={}){
  return {
    gameId:'g1',awayTeam:'Buffalo Bills',homeTeam:'Houston Texans',kickoffAt:'2026-09-13T17:00:00Z',
    market:{awayMoneyline:-210,homeMoneyline:175,awayWinPct:68,homeWinPct:32},
    spread:{away:-6.5,home:6.5,projectedTeam:'Buffalo Bills',coverRate:62,grade:'B',sampleSize:8,status:'ready'},
    movement:{direction:'TOWARD_AWAY',movementMagnitude:1,text:'Line moved 1 toward Buffalo Bills'},
    history:{away:{coach:'Sean McDermott',overall:{games:100},notable:[]},home:{coach:'DeMeco Ryans',overall:{games:50},notable:[]}},
    context:{venue:'NRG Stadium · closed · turf',observations:[]},
    outlook:{level:'MODERATE AGREEMENT',team:'Buffalo Bills',inputs:{historical:null}},
    final:null,
    pick:'Buffalo Bills',pickResult:null,
    ...overrides
  };
}

test('canonical weekly payload excludes mutable personal pick state',()=>{
  const legacy=[game()];
  const p=buildCanonicalWeeklyPayload({season:2026,week:1,games:legacy,builtAt:'2026-09-12T00:00:00.000Z'});
  assert.equal(p.schemaVersion,'weekly-intelligence/v1');
  assert.equal(p.games.length,1);
  assert.equal('pick' in p.games[0],false);
  assert.equal('pickResult' in p.games[0],false);
  assert.equal(p.contract.personalPicksEmbedded,false);
  assert.equal(p.contract.gameNavigationAdditionalIntelligenceReads,0);
});

test('canonical payload preserves legacy market spread final identity fields',()=>{
  const legacy=[game({final:{awayScore:24,homeScore:20}})];
  const p=buildCanonicalWeeklyPayload({season:2026,week:1,games:legacy});
  const parity=compareWeeklyParity(p,legacy);
  assert.equal(parity.ok,true,JSON.stringify(parity.mismatches));
});

test('parity checker catches a changed spread value before cutover',()=>{
  const legacy=[game()];
  const p=buildCanonicalWeeklyPayload({season:2026,week:1,games:legacy});
  p.games[0].spread.away=-7;
  const parity=compareWeeklyParity(p,legacy);
  assert.equal(parity.ok,false);
  assert.ok(parity.mismatches.some(x=>x.field==='spread.away'));
});

test('read budget encodes zero-query intelligence navigation target',()=>{
  assert.deepEqual(READ_BUDGET,{
    initialWeeklyArtifactD1Rows:0,
    dashboardToGamesD1Rows:0,
    openSingleGameD1Rows:0,
    openAllGamesD1Rows:0,
    returnToDashboardD1Rows:0
  });
});

test('production remains v0.21 while v0.22 is shadow-only',()=>{
  const wrangler=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
  assert.match(wrangler,/src\/v021-entry\.js/);
  assert.doesNotMatch(wrangler,/v022/);
});

test('architecture plan explicitly blocks wrapper-chain cutover and heavy fallbacks',()=>{
  const doc=readFileSync(new URL('../docs/V022_CORE_CONSOLIDATION.md',import.meta.url),'utf8');
  assert.match(doc,/shadow only/i);
  assert.match(doc,/never run historical\/raw analytical SQL/i);
  assert.match(doc,/failed build must never replace the last known-good weekly artifact/i);
  assert.match(doc,/Personal weekly picks and Survivor entry state remain separate/i);
});
