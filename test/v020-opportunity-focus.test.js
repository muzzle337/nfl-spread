import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluateOpportunity, rankOpportunities } from '../src/opportunity-focus.js';
import { withOpportunityFocusUi } from '../src/opportunity-focus-ui.js';
import { APP_VERSION } from '../src/v020-entry.js';

function game(overrides={}){
  return {
    gameId:'g1',awayTeam:'Buffalo Bills',homeTeam:'Houston Texans',kickoffAt:'2026-09-13T17:00:00Z',
    market:{awayWinPct:68,homeWinPct:32,awayMoneyline:-210,homeMoneyline:175},
    spread:{projectedTeam:'Buffalo Bills',coverRate:62,grade:'B',sampleSize:8},
    movement:{direction:'TOWARD_AWAY',movementMagnitude:1,text:'Line moved 1 toward Buffalo Bills'},
    history:{away:{coach:'Sean McDermott',notable:[{label:'Road games',games:20,winPct:70}]},home:{coach:'DeMeco Ryans',notable:[]}},
    context:{observations:[{kind:'supporting',label:'Rest edge',detail:'3 more rest days',side:'AWAY'}]},
    outlook:{inputs:{historical:'Buffalo Bills'}},
    ...overrides
  };
}

test('v0.20 ranks independent evidence as focus without inventing probability',()=>{
  const r=evaluateOpportunity(game());
  assert.equal(r.focus,'HIGH');
  assert.equal(r.team,'Buffalo Bills');
  assert.equal(r.bestUse,'SPREAD + OUTRIGHT');
  assert.ok(r.independentSignals>=3);
  assert.match(r.guardrail,/not a win probability/i);
  assert.equal('probability' in r,false);
});

test('conflicting evidence is surfaced rather than averaged away',()=>{
  const r=evaluateOpportunity(game({spread:{projectedTeam:'Houston Texans',coverRate:66,grade:'B',sampleSize:8}}));
  assert.equal(r.team,'Buffalo Bills');
  assert.ok(r.conflict.some(x=>x.team==='Houston Texans'));
  assert.match(r.summary,/conflict/i);
});

test('ranking puts higher-focus games first',()=>{
  const low=game({gameId:'g2',market:{awayWinPct:51,homeWinPct:49},spread:{},history:null,context:{observations:[]},outlook:{inputs:{}},movement:null});
  const ranked=rankOpportunities([low,game()]);
  assert.equal(ranked[0].gameId,'g1');
});

test('Opportunity Edge Focus UI is mobile-safe, non-polling and compiles',()=>{
  const base='<!doctype html><html><head></head><body><div class="app-shell"><div class="content"></div></div></body></html>';
  const html=withOpportunityFocusUi(base);
  assert.match(html,/Top Focus Games/);
  assert.match(html,/Opportunity · Edge · Focus/);
  assert.doesNotMatch(html,/MutationObserver/);
  assert.doesNotMatch(html,/setInterval\([^\n]*fetch/);
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach(s=>assert.doesNotThrow(()=>new Function(s)));
});

test('v0.20.1 read-safety and fresh final-score contract remain under later wrappers',async()=>{
  assert.equal(APP_VERSION,'0.20.1');
  const fs=await import('node:fs/promises');
  const wrangler=await fs.readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8');
  const pkg=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url),'utf8'));
  const route=readFileSync(new URL('../src/v020-entry.js',import.meta.url),'utf8');
  const engine=readFileSync(new URL('../src/opportunity-focus.js',import.meta.url),'utf8');
  const resultSync=readFileSync(new URL('../src/result-sync.js',import.meta.url),'utf8');
  assert.match(wrangler,/src\/v02[0-9]-entry\.js/);
  assert.ok(/^0\.2[0-9]\./.test(pkg.version));
  assert.match(route,/rawHistoricalGames:false/);
  assert.doesNotMatch(route+engine,/historical_games/);
  assert.match(route,/SPREAD_REFRESH_CRON/);
  assert.match(route,/syncResultsIfDue/);
  assert.match(route,/invalidateWeeklyOutlookCache/);
  assert.match(route,/scheduled_hourly/);
  assert.match(resultSync,/FINAL_GRACE_HOURS = 4/);
});
