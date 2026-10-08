import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/v022-ui.js',import.meta.url),'utf8');
const wrapper=fs.readFileSync(new URL('../src/v0259-entry.js',import.meta.url),'utf8');

test('canonical market signal context preserves scoped thresholds and labels',()=>{
  assert.match(source,/mag<1\|\|!toward/);
  assert.match(source,/mag>=1&&toward===projected/);
  assert.match(source,/CONFIRMS TIER/);
  assert.match(source,/CONFLICTS WITH TIER/);
  assert.match(source,/NEUTRAL · small move/);
  assert.match(source,/13–3 ATS · n=16 early sample/);
  assert.match(source,/marketSignalHtml\(g\)/);
});

test('ATS market confirmation uses spread movement only',()=>{
  const start=source.indexOf('function marketSignalContext');
  const end=source.indexOf('function marketSignalHtml',start);
  const classifier=source.slice(start,end);
  assert.doesNotMatch(classifier,/moneylineMovement|probabilityMagnitude/i);
});

test('retired entry wrapper no longer injects market UI',()=>{
  assert.doesNotMatch(wrapper,/MutationObserver|MARKET_CONTEXT|market-signal-context/);
});
