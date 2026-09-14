import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withV021Ui } from '../src/v021-ui.js';
import { withCanonicalGameDetail } from '../src/canonical-game-detail.js';
import { withV0217DetailGuard } from '../src/v0217-detail-guard.js';
import { APP_VERSION } from '../src/v0217-entry.js';

test('v0.22 uses the canonical entry while retaining the v0.21.8 score fix',()=>{
  const wrangler=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(APP_VERSION,'0.21.8');
  assert.equal(pkg.version,'0.22.0');
  assert.match(wrangler,/src\/v022-entry\.js/);
});

test('freshness contract never reads raw historical games',()=>{
  const freshness=readFileSync(new URL('../src/data-freshness.js',import.meta.url),'utf8');
  const entry=readFileSync(new URL('../src/v021-entry.js',import.meta.url),'utf8');
  assert.doesNotMatch(freshness,/FROM\s+historical_games/i);
  assert.match(freshness,/historical_coach_summaries/);
  assert.match(entry,/\/api\/data\/freshness/);
  assert.match(entry,/normalUiRawHistoryReads:false/);
});

test('canonical UI exposes source freshness and complete game intelligence without background fetching',()=>{
  const base='<!doctype html><html><head></head><body><div class="app-shell"><div class="content"><div class="status-strip"></div></div></div></body></html>';
  const html=withV021Ui(base);
  assert.match(html,/DATA STATUS/);
  assert.match(html,/Scores/);
  assert.match(html,/Market/);
  assert.match(html,/Context/);
  assert.match(html,/Historical/);
  assert.match(html,/Weekly intelligence/);
  assert.match(html,/Opportunity \/ edge/);
  assert.match(html,/Historical context · 2015–2025/);
  assert.match(html,/FINAL/);
  assert.match(html,/data-cg19-board/);
  assert.doesNotMatch(html,/setInterval\([^\n]*fetch/);
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach(s=>assert.doesNotThrow(()=>new Function(s)));
});

test('canonical Game Detail runtime matches approved hierarchy and compiles',()=>{
  const base='<!doctype html><html><head></head><body><div class="detail"><header class="detail-head"><div class="detail-title">BUF @ HOU</div></header><div class="match-hero"></div><main class="detail-content"></main></div></body></html>';
  const html=withCanonicalGameDetail(base);
  assert.match(html,/OUR THESIS/);
  assert.match(html,/CURRENT SPREAD/);
  assert.match(html,/CURRENT ML/);
  assert.match(html,/OUR ORIGINAL THESIS/);
  assert.match(html,/WHY WE CARED/);
  assert.match(html,/Line history/);
  assert.match(html,/Sportsbooks/);
  assert.match(html,/Historical evidence/);
  assert.match(html,/canonical-game-detail/);
  assert.doesNotMatch(html,/PROJECTED · CURRENT SEASON/);
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach(s=>assert.doesNotThrow(()=>new Function(s)));
});

test('detail fallback independently mounts the approved Game Detail hierarchy',()=>{
  const base='<!doctype html><html><body><div id="app"><div class="detail"><header class="detail-head"><div class="detail-title">BUF @ HOU</div></header><main class="detail-content"></main></div></div></body></html>';
  const html=withV0217DetailGuard(base);
  assert.match(html,/data-canonical-game-detail/);
  assert.match(html,/OUR ORIGINAL THESIS/);
  assert.match(html,/WHY WE CARED/);
  assert.match(html,/Historical evidence/);
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach(s=>assert.doesNotThrow(()=>new Function(s)));
});

test('manual refresh checks scores before market and verifies final writes',()=>{
  const entry=readFileSync(new URL('../src/v0217-entry.js',import.meta.url),'utf8');
  assert.match(entry,/Refresh Game Data/);
  assert.match(entry,/scores:scores,market:b/);
  assert.match(entry,/manualForced:true/);
  assert.match(entry,/MANUAL_SCORE_REFRESH/);
  assert.match(entry,/fetchNflScores/);
  assert.match(entry,/ingestCompletedScores/);
  assert.match(entry,/invalidateWeeklyOutlookCache/);
  assert.match(entry,/providerSummary/);
  assert.match(entry,/weekStatus/);
  assert.match(entry,/finalizationVerified/);
});

test('final cards render status and scores directly and replace pregame edge with postgame stats',()=>{
  const entry=readFileSync(new URL('../src/v021-entry.js',import.meta.url),'utf8');
  const data=readFileSync(new URL('../src/dashboard-data.js',import.meta.url),'utf8');
  assert.match(entry,/df21-game-status/);
  assert.match(entry,/df21-team-score/);
  assert.match(entry,/game\.final\?'FINAL':'UPCOMING'/);
  assert.match(entry,/FINAL SPREAD RESULT/);
  assert.doesNotMatch(entry,/PREGAME TIER EDGE/);
  assert.match(entry,/post\.spreadResult==='PUSH'/);
  assert.match(entry,/COVERED/);
  assert.match(entry,/finalCardsPostgameOnly:true/);
  assert.match(entry,/finalCardPostgameStats:true/);
  assert.match(entry,/font-size:28px/);
  assert.match(data,/postgameAnalysis/);
  assert.match(data,/settleAgainstSpread/);
  assert.match(data,/liveBucket/);
});

test('detail matchup detection is resilient beyond legacy detail-title selector',()=>{
  const ui=readFileSync(new URL('../src/v021-ui.js',import.meta.url),'utf8');
  assert.match(ui,/detail-header,h1,h2,h3/);
  assert.match(ui,/match\(\/\\b\(\[A-Z\]/);
});