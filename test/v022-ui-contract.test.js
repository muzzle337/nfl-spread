import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import worker from '../src/v022-entry.js';
import { APP_VERSION, canonicalAppPage } from '../src/v022-ui.js';

test('v0.24.1 serves one canonical four-screen shell',async()=>{
  assert.equal(APP_VERSION,'0.24.1');
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

  assert.match(html,/function dashboard\(\).*status\(\)\+pulse\(\)\+performance\(\)\+focus\(\)\+resultsSummary\(\)\+pickSummary\(\)/);
  assert.match(html,/function games\(\).*gamesSection\(\)/);
  assert.match(html,/function picks\(\)/);
  assert.match(html,/data-week-select/);
  assert.match(html,/data-bucket/);
  assert.match(html,/Qualified Games This Week/);
  assert.match(html,/Upcoming games in categories currently hitting 55%\+/);
  assert.match(html,/All Season Contributors/);
  assert.match(html,/Weekly Momentum/);
  assert.match(html,/seasonPulse/);
  assert.match(html,/QUALIFIED/);
  assert.match(html,/Current Pregame Market/);
  assert.match(html,/Closing Pregame Market/);
  assert.match(html,/Repair Pregame Markets/);
  assert.match(html,/Closing line unavailable/);
  assert.match(html,/Historical Evidence/);
  assert.match(html,/Situational Trends/);
  assert.match(html,/Signal Performance/);
  assert.match(html,/frozen pregame/);
  assert.match(html,/function frozenResult/);
  assert.match(html,/Frozen recommendation at kickoff/);
  assert.match(html,/ATS and outright results stay separate/);
  assert.match(html,/data-signal/);
  assert.match(html,/Season signal tracking/);
  assert.match(html,/outright/);
  assert.match(html,/\^\[A-Z\]\{2,3\}\$/);
  assert.match(html,/NFL baseline/);
  assert.match(html,/supporting/);
  assert.match(html,/conflicting/);
  assert.match(html,/Expert Read/);
  assert.match(html,/Strategy/);
  assert.match(html,/Brain/);
  assert.match(html,/Context/);
  assert.match(html,/ML /);
  assert.match(html,/Market win/);
  assert.match(html,/Category ATS/);
  assert.match(html,/Game Insight · strategy, signals, history & context/);
  assert.match(html,/Open full game analysis/);
  assert.match(html,/Open .+ → /);
  assert.match(html,/Market Movement/);
  assert.match(html,/Moneyline history unavailable/);
  assert.match(html,/probability pt/);
  assert.match(html,/Spread and moneyline both strengthened/);
  assert.match(html,/FINAL SPREAD RESULT/);
  assert.match(html,/Spread Result/);
  assert.match(html,/<details><summary>Sportsbooks/);
  assert.match(html,/Load Week .+ Lines/);
  assert.match(html,/one targeted spreads \+ moneylines request/);
  assert.match(html,/Load 2026 Season Schedule/);
});

test('canonical shell uses approved APIs without recurring background refresh',()=>{
  const html=canonicalAppPage();
  assert.match(html,/\/api\/dashboard\/nfl/);
  assert.match(html,/\/api\/focus\/opportunities/);
  assert.match(html,/q\('\/api\/pool\/outlooks'\)/);
  assert.match(html,/q\('\/api\/dashboard\/nfl'\)/);
  assert.match(html,/q\('\/api\/focus\/opportunities'\)/);
  assert.match(html,/\/api\/data\/freshness/);
  assert.match(html,/\/api\/tiers\/contributors/);
  assert.match(html,/\/api\/signals\/performance/);
  assert.match(html,/\/api\/schedule\/nfl/);
  assert.match(html,/\/api\/ingest\/nfl\/results/);
  assert.match(html,/\/api\/ingest\/nfl/);
  assert.match(html,/This makes one targeted Odds API request/);
  assert.doesNotMatch(html,/setTimeout\([^)]*load|setInterval/);
});

test('Dashboard route honors an explicitly selected schedule week',()=>{
  const entry=readFileSync(new URL('../src/v022-entry.js',import.meta.url),'utf8');
  const data=readFileSync(new URL('../src/dashboard-data.js',import.meta.url),'utf8');
  const productionSmoke=readFileSync(new URL('../.github/workflows/production-smoke.yml',import.meta.url),'utf8');
  const productionCards=readFileSync(new URL('../scripts/verify-production-cards.mjs',import.meta.url),'utf8');
  const productionDetail=readFileSync(new URL('../scripts/verify-production-game-detail.mjs',import.meta.url),'utf8');
  assert.match(entry,/dashboardSnapshot\(env\.DB,new Date\(\),target\)/);
  assert.match(data,/dashboardSnapshot\(db, now = new Date\(\), selected = null\)/);
  assert.match(data,/requestedSeason/);
  assert.match(data,/requestedWeek/);
  assert.match(productionSmoke,/dashboard\/nfl\?season=2026&week=1/);
  assert.match(productionCards,/dashboard\/nfl\?season=2026&week=1/);
  assert.match(productionCards,/page\.goto\(base\+'\/\?week=1'/);
  assert.match(productionDetail,/page\.goto\(base\+'\/\?week=1'/);
});

test('active worker entry bypasses the legacy HTML injection chain',()=>{
  const entry=readFileSync(new URL('../src/v022-entry.js',import.meta.url),'utf8');
  assert.match(entry,/canonicalAppPage\(\)/);
  assert.match(entry,/canonicalShell:true/);
  assert.match(entry,/survivorActive:false/);
  assert.match(entry,/legacyUiInjection:false/);
  assert.doesNotMatch(entry,/withMoneylineSurvivorUi|withGameOutlookPicksUi|withV021Ui|withCanonicalGameDetail|upgradeHtml/);
  assert.doesNotMatch(entry,/from ['"]\.\/v0(?:10|11|12|13|14|15|16|17|18|19|20|21)/);
  assert.doesNotMatch(entry,/from ['"]\.\/index\.js|coreApp/);
  assert.match(entry,/Promise\.all\(\[\s*\(async\(\)=>\{[\s\S]*hourlyResultSync\(env,now\)\.catch/);
  assert.match(entry,/canonicalBackendRouter:true/);
  assert.match(entry,/legacyEntryDelegation:false/);
});

test('retired wrappers and injected renderers are absent from the source tree',()=>{
  const files=readdirSync(new URL('../src/',import.meta.url)).filter(name=>name.endsWith('.js'));
  assert.deepEqual(files.filter(name=>/^v0(?:1[0-9]|20|21|217)-entry\.js$/.test(name)),[]);
  assert.deepEqual(files.filter(name=>/(?:-ui|detail-guard|pwa-entry|^index|^dashboard|^help|^survivor)/.test(name)),['dashboard-data.js','v022-ui.js']);
  const runtime=files.map(name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8')).join('\n');
  assert.doesNotMatch(runtime,/MutationObserver|setInterval|survivor_future_markets|storeFutureSurvivorMarkets/);
});

test('canonical backend reports its contract and deactivates Survivor routes',async()=>{
  const health=await worker.fetch(new Request('https://example.com/api/health'),{});
  assert.equal(health.status,200);
  const body=await health.json();
  assert.equal(body.version,'0.24.1');
  assert.equal(body.canonicalBackendRouter,true);
  assert.equal(body.legacyEntryDelegation,false);
  assert.equal(body.survivorActive,false);
  assert.equal(body.picksTierContext,true);
  assert.equal(body.picksMarketWinSeparatedFromAts,true);
  assert.equal(body.moneylineMovementSummary,true);
  assert.equal(body.marketAlignment,true);
  assert.equal(body.movementUsesStoredSnapshotsOnly,true);
  assert.equal(body.teamHistoricalEvidence,true);
  assert.equal(body.currentCoachHistoricalEvidence,true);
  assert.equal(body.leagueHistoricalBaseline,true);
  assert.equal(body.historicalEvidenceAffectsFocus,false);
  assert.equal(body.historicalEvidenceMaxItems,3);
  assert.equal(body.historicalEvidenceCached,true);
  assert.equal(body.situationalTrends,true);
  assert.equal(body.situationalTrendOutcome,'outright');
  assert.equal(body.situationalTrendTimeframe,'2023-2025');
  assert.equal(body.situationalTrendMaxItems,2);
  assert.equal(body.situationalTrendsAffectFocus,false);
  assert.equal(body.situationalTrendsCached,true);
  assert.equal(body.signalPerformanceTracking,true);
  assert.equal(body.signalPerformanceStartVersion,'0.24.0');
  assert.equal(body.pregameSignalSnapshots,true);
  assert.equal(body.signalPerformanceAffectsFocus,false);
  assert.equal(body.signalPerformanceAffectsPicks,false);
  assert.equal(body.signalPerformanceUsesStoredDataOnly,true);
  assert.equal(body.pregameMarketIntegrity,true);
  assert.equal(body.postKickoffMarketsRejected,true);
  assert.equal(body.signalGradingUsesRecommendationLine,true);
  assert.equal(body.rawPlayByPlayReadDuringUi,false);
  assert.equal(body.canonicalTeamAliases,true);
  assert.equal(body.seasonTierMomentum,true);

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
  assert.match(script,/VERSION = "0\.24\.1"/);
  assert.match(script,/GET_VERSION/);
  assert.doesNotMatch(script,/VERSION = "0\.7\.0"/);
});

test('retired admin URL opens the canonical Tools screen',async()=>{
  const response=await worker.fetch(new Request('https://example.com/admin/ingest'),{});
  assert.equal(response.status,302);
  assert.equal(response.headers.get('location'),'/?tab=tools');
  assert.match(canonicalAppPage(),/new URLSearchParams\(location\.search\)/);
});
