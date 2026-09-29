import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('canonical Picks renders checkpoint without a separate fetch or shell', () => {
  const ui=readFileSync(new URL('../src/v022-ui.js',import.meta.url),'utf8');
  assert.match(ui,/function checkpointPanel\(\)/);
  assert.match(ui,/\(S\.pool\|\|\{\}\)\.checkpoint/);
  assert.match(ui,/aria-label="Weekly checkpoint"/);
  const start=ui.indexOf('function picks()');
  const end=ui.indexOf('function tool(',start);
  const picks=ui.slice(start,end);
  assert.match(picks,/checkpointPanel\(\)/);
  assert.doesNotMatch(picks,/fetch\(|json\(/);
});
