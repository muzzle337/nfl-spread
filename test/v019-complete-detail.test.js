import test from 'node:test';
import assert from 'node:assert/strict';
import { withCompleteGameDetailUi } from '../src/complete-game-detail-ui.js';
import { withV019PolishUi } from '../src/v019-polish-ui.js';
import { APP_VERSION } from '../src/v019-entry.js';

test('v0.19.x exposes all-game history and complete game detail',()=>{
  assert.equal(APP_VERSION,'0.19.1');
  const base='<!doctype html><html><head></head><body><div class="app-shell"><div class="content"></div></div></body></html>';
  const html=withV019PolishUi(withCompleteGameDetailUi(base));
  assert.match(html,/Historical Indicators — Every Game/);
  assert.match(html,/Complete Game Detail/);
  assert.match(html,/History available/);
  assert.match(html,/all applicable situations/i);
  assert.match(html,/Non-notable rows are still shown/i);
  assert.match(html,/2015–2025/);
  assert.match(html,/market win/);
  assert.match(html,/Current-season spread data/);
  assert.match(html,/Context/);
  assert.match(html,/data-hist16-board\]\{display:none/);
  assert.doesNotMatch(html,/MutationObserver/);
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  scripts.forEach(s=>assert.doesNotThrow(()=>new Function(s)));
});

test('v0.19.1 remains covered beneath later production wrappers',async()=>{
  const fs=await import('node:fs/promises');
  const v020=await fs.readFile(new URL('../src/v020-entry.js',import.meta.url),'utf8');
  assert.match(v020,/import app from ['"]\.\/v019-entry\.js['"]/);
});
