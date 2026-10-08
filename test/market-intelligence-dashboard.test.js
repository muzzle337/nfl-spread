import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/v022-ui.js',import.meta.url),'utf8');

test('qualified Dashboard cards render Market Intelligence context',()=>{
  const start=source.indexOf('function focus()');
  const end=source.indexOf('function performance()',start);
  assert.ok(start>=0&&end>start);
  const focus=source.slice(start,end);
  assert.match(focus,/marketSignalHtml\(g\)/);
  assert.match(focus,/movementText\(g\)/);
});

test('qualified games prioritize confirmation and demote conflicts without changing tier percentages',()=>{
  const start=source.indexOf('function focusMarketRank');
  const end=source.indexOf('function gameRead',start);
  assert.ok(start>=0&&end>start);
  const focus=source.slice(start,end);
  assert.match(focus,/marketSignalContext/);
  assert.match(focus,/confirm/);
  assert.match(focus,/conflict/);
  assert.match(focus,/focusMarketRank\(b\)-focusMarketRank\(a\)/);
  assert.doesNotMatch(focus,/projectedCoverRate\s*[+\-*/]=/);
});

test('market intelligence has distinct confirm conflict and neutral visual states',()=>{
  assert.match(source,/\.market-read\.confirm/);
  assert.match(source,/\.market-read\.conflict/);
  assert.match(source,/\.market-read\.neutral/);
  assert.match(source,/13–3 ATS · n=16 early sample/);
});
