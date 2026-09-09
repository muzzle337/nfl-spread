import test from 'node:test';
import assert from 'node:assert/strict';
import { withStabilityUi } from '../src/stability-ui.js';
import { withPicksPolishUi } from '../src/picks-polish-ui.js';
import { APP_VERSION } from '../src/v018-entry.js';

test('v0.18.2 exposes centralized stability guard without MutationObserver',()=>{
  assert.equal(APP_VERSION,'0.18.2');
  const html=withStabilityUi('<!doctype html><html><body><div class="app-shell"><div class="content"></div></div></body></html>');
  assert.match(html,/data-app-view/);
  assert.match(html,/keepOne/);
  assert.match(html,/view!==\'dashboard\'/);
  assert.doesNotMatch(html,/MutationObserver/);
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach(s=>assert.doesNotThrow(()=>new Function(s)));
});

test('Picks grading no longer polls D1 every five seconds',()=>{
  const html=withPicksPolishUi('<!doctype html><html><body><div class="bottom-nav"></div><div id="app"></div></body></html>');
  assert.doesNotMatch(html,/setInterval\(tick,5000\)/);
  assert.match(html,/gradedView/);
  assert.match(html,/data-pool17-pick/);
});

test('stability diagnostics endpoint checks only lightweight contracts',async()=>{
  const src=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../src/v018-entry.js',import.meta.url),'utf8'));
  assert.match(src,/\/api\/stability\/contracts/);
  assert.match(src,/\/api\/dashboard\/nfl/);
  assert.match(src,/deferredHeavyContracts/);
  const paths=src.match(/const paths=\[([^\]]+)\]/);
  assert.ok(paths);
  assert.doesNotMatch(paths[1],/context\/opportunities|history\/matchups|pool\/outlooks/);
  assert.match(src,/validJson/);
});
