import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/v0259-entry.js',import.meta.url),'utf8');

test('market signal context preserves scoped thresholds and labels',()=>{
  assert.match(source,/movement\.mag>=1&&movement\.toward===projected/);
  assert.match(source,/CONFIRMS TIER/);
  assert.match(source,/CONFLICTS WITH TIER/);
  assert.match(source,/NEUTRAL · small move/);
  assert.match(source,/13–3 ATS · n=16 early sample/);
});

test('moneyline movement is not used to classify ATS market confirmation',()=>{
  assert.doesNotMatch(source,/moneylineMovement/i);
  assert.doesNotMatch(source,/probabilityMagnitude/);
});
