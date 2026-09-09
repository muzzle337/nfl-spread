import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_VERSION } from '../src/v019-entry.js';

const matchups=readFileSync(new URL('../src/history-matchups.js',import.meta.url),'utf8');
const history=readFileSync(new URL('../src/history.js',import.meta.url),'utf8');
const wrapper=readFileSync(new URL('../src/v019-entry.js',import.meta.url),'utf8');

test('v0.19.1 normal matchup history is summary-only',()=>{
  assert.equal(APP_VERSION,'0.19.1');
  assert.match(matchups,/historical_coach_summaries/);
  assert.doesNotMatch(matchups,/historical_games/);
  assert.doesNotMatch(matchups,/historicalCoachIndicators/);
  assert.match(wrapper,/normalUiRawHistoryReads:false/);
  assert.match(wrapper,/historicalSummaryOnlyReads:true/);
});

test('raw historical games remain confined to explicit history storage and rebuild code',()=>{
  assert.match(history,/SELECT \* FROM historical_games/);
  assert.doesNotMatch(matchups,/SELECT \* FROM historical_games/);
});
