import test from 'node:test';
import assert from 'node:assert/strict';
import { withStabilityUi } from '../src/stability-ui.js';
import { APP_VERSION } from '../src/v018-entry.js';

test('v0.18 exposes centralized stability guard without MutationObserver',()=>{
  assert.equal(APP_VERSION,'0.18.0');
  const html=withStabilityUi('<!doctype html><html><body><div class="app-shell"><div class="content"></div></div></body></html>');
  assert.match(html,/data-app-view/);
  assert.match(html,/keepOne/);
  assert.match(html,/view!==\'dashboard\'/);
  assert.doesNotMatch(html,/MutationObserver/);
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach(s=>assert.doesNotThrow(()=>new Function(s)));
});

test('stability diagnostics endpoint is present and checks core JSON contracts',async()=>{
  const src=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../src/v018-entry.js',import.meta.url),'utf8'));
  assert.match(src,/\/api\/stability\/contracts/);
  assert.match(src,/\/api\/dashboard\/nfl/);
  assert.match(src,/\/api\/context\/opportunities/);
  assert.match(src,/\/api\/history\/matchups/);
  assert.match(src,/\/api\/pool\/outlooks/);
  assert.match(src,/validJson/);
});
