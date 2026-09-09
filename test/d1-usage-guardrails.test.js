import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../src/v018-entry.js';

const weekly=readFileSync(new URL('../src/weekly-picks.js',import.meta.url),'utf8');
const history=readFileSync(new URL('../src/history.js',import.meta.url),'utf8');
const shell=readFileSync(new URL('../src/v018-entry.js',import.meta.url),'utf8');
const polish=readFileSync(new URL('../src/picks-polish-ui.js',import.meta.url),'utf8');

test('v0.18.2 advertises D1 cache guardrails',()=>{
  assert.equal(APP_VERSION,'0.18.2');
  assert.match(shell,/historicalSummaryCache:true/);
  assert.match(shell,/weeklyOutlookCache:true/);
  assert.match(shell,/heavyDiagnosticsDisabled:true/);
});

test('normal weekly outlook reads a one-row cache before rebuilding heavy inputs',()=>{
  assert.match(weekly,/SELECT payload_json,built_at FROM weekly_outlook_cache/);
  assert.match(weekly,/cachedWeeklyOutlookBase/);
  assert.match(weekly,/INSERT INTO weekly_outlook_cache/);
  assert.match(weekly,/invalidateWeeklyOutlookCache/);
});

test('historical coach indicators use compact summaries before raw history fallback',()=>{
  const summaryIndex=history.indexOf('SELECT summary_json,rebuilt_at FROM historical_coach_summaries');
  const rawIndex=history.indexOf('SELECT * FROM historical_games');
  assert.ok(summaryIndex>=0);
  assert.ok(rawIndex>summaryIndex);
  assert.match(history,/rebuildHistoricalCoachSummaries/);
  assert.match(history,/coachesCached/);
});

test('stability diagnostics no longer execute heavy context history and pool contracts',()=>{
  assert.match(shell,/deferredHeavyContracts/);
  const pathsMatch=shell.match(/const paths=\[([^\]]+)\]/);
  assert.ok(pathsMatch);
  assert.doesNotMatch(pathsMatch[1],/context\/opportunities|history\/matchups|pool\/outlooks/);
});

test('Picks polish never restores continuous five-second outlook polling',()=>{
  assert.doesNotMatch(polish,/setInterval\(tick,5000\)/);
  assert.doesNotMatch(polish,/setInterval\([^\n]*\/api\/pool\/outlooks/);
});
