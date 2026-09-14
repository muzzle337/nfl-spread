import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/v022-entry.js';
import { APP_VERSION, canonicalAppPage } from '../src/v022-ui.js';

test('v0.22 serves one canonical four-screen shell',async()=>{
  assert.equal(APP_VERSION,'0.22.0');
  const response=await worker.fetch(new Request('https://example.com/'),{});
  assert.equal(response.status,200);
  const html=await response.text();
  assert.match(html,/Dashboard/);
  assert.match(html,/Games/);
  assert.match(html,/Picks/);
  assert.match(html,/Tools/);
  assert.doesNotMatch(html,/Survivor/);
  assert.doesNotMatch(html,/MutationObserver/);
  assert.doesNotMatch(html,/setInterval/);
  assert.doesNotMatch(html,/data-pool17-nav|data-survivor-nav|data-cg19-board/);
});

test('canonical client runtime compiles and exposes audited screen contracts',()=>{
  const html=canonicalAppPage();
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]);
  assert.equal(scripts.length,1);
  scripts.forEach(script=>assert.doesNotThrow(()=>new Function(script)));

  assert.match(html,/function dashboard\(\).*status\(\)\+pulse\(\)\+focus\(\)\+pickSummary\(\)/);
  assert.match(html,/function games\(\).*gamesSection\(\)/);
  assert.match(html,/function picks\(\)/);
  assert.match(html,/data-week/);
  assert.match(html,/FINAL SPREAD RESULT/);
  assert.match(html,/Spread Result/);
  assert.match(html,/<details><summary>Sportsbooks/);
  assert.match(html,/Scores first, then current spreads and moneylines/);
});

test('canonical shell uses approved APIs without recurring background refresh',()=>{
  const html=canonicalAppPage();
  assert.match(html,/\/api\/dashboard\/nfl/);
  assert.match(html,/\/api\/focus\/opportunities/);
  assert.match(html,/\/api\/pool\/outlooks\?season=/);
  assert.match(html,/\/api\/data\/freshness/);
  assert.match(html,/\/api\/ingest\/nfl\/results/);
  assert.match(html,/\/api\/ingest\/nfl/);
  assert.doesNotMatch(html,/setTimeout\([^)]*load|setInterval/);
});

test('active worker entry bypasses the legacy HTML injection chain',()=>{
  const entry=readFileSync(new URL('../src/v022-entry.js',import.meta.url),'utf8');
  assert.match(entry,/canonicalAppPage\(\)/);
  assert.match(entry,/canonicalShell:true/);
  assert.match(entry,/survivorActive:false/);
  assert.match(entry,/legacyUiInjection:false/);
  assert.doesNotMatch(entry,/withMoneylineSurvivorUi|withGameOutlookPicksUi|withV021Ui|withCanonicalGameDetail|upgradeHtml/);
  assert.doesNotMatch(entry,/from ['"]\.\/v0(?:10|11|12|13|14|15|16|17|18|19|20|21)/);
  assert.match(entry,/import coreApp from '\.\/index\.js'/);
  assert.match(entry,/canonicalBackendRouter:true/);
  assert.match(entry,/legacyEntryDelegation:false/);
});

test('canonical backend reports its contract and deactivates Survivor routes',async()=>{
  const health=await worker.fetch(new Request('https://example.com/api/health'),{});
  assert.equal(health.status,200);
  const body=await health.json();
  assert.equal(body.version,'0.22.0');
  assert.equal(body.canonicalBackendRouter,true);
  assert.equal(body.legacyEntryDelegation,false);
  assert.equal(body.survivorActive,false);

  const survivor=await worker.fetch(new Request('https://example.com/api/survivor'),{});
  assert.equal(survivor.status,410);
  assert.match((await survivor.json()).error,/inactive/i);
});

test('canonical backend directly serves synchronized PWA assets',async()=>{
  const manifest=await worker.fetch(new Request('https://example.com/manifest.webmanifest'),{});
  assert.equal(manifest.status,200);
  assert.equal((await manifest.json()).display,'standalone');

  const sw=await worker.fetch(new Request('https://example.com/sw.js'),{});
  const script=await sw.text();
  assert.match(script,/VERSION = "0\.22\.0"/);
  assert.match(script,/GET_VERSION/);
  assert.doesNotMatch(script,/VERSION = "0\.7\.0"/);
});
