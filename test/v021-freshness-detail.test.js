import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withV021Ui } from '../src/v021-ui.js';
import { APP_VERSION } from '../src/v021-entry.js';

test('v0.21 is the production entry and package version',()=>{
  const wrangler=readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8');
  const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
  assert.equal(APP_VERSION,'0.21.0');
  assert.equal(pkg.version,'0.21.0');
  assert.match(wrangler,/src\/v021-entry\.js/);
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

test('detail matchup detection is resilient beyond legacy detail-title selector',()=>{
  const ui=readFileSync(new URL('../src/v021-ui.js',import.meta.url),'utf8');
  assert.match(ui,/detail-header,h1,h2,h3/);
  assert.match(ui,/match\(\/\\b\(\[A-Z\]/);
});
