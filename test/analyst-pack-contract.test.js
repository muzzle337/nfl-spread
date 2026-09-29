import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Analyst Pack is a read-only stored-data aggregation with complete contributor ledgers",()=>{
  const source=readFileSync(new URL("../src/analyst-pack.js",import.meta.url),"utf8");
  assert.match(source,/storedDataOnly:true/);
  assert.match(source,/oddsApiCalled:false/);
  assert.match(source,/providerCreditsUsed:0/);
  assert.match(source,/tierContributorPack/);
  assert.match(source,/signalPerformancePack/);
  assert.match(source,/storedGameOutlooksForAnalysis/);
  assert.match(source,/lineMovementsForWeek/);
  assert.doesNotMatch(source,/fetchNflMarkets|fetchNflScores|ODDS_API_KEY|\/api\/ingest/);
});

test("Analyst Pack game outlooks do not mutate caches, frozen snapshots, or personal picks",()=>{
  const source=readFileSync(new URL("../src/weekly-picks.js",import.meta.url),"utf8");
  const start=source.indexOf("export async function storedGameOutlooksForAnalysis");
  assert.notEqual(start,-1);
  const implementation=source.slice(start);
  assert.match(implementation,/buildWeeklyOutlookBase/);
  assert.match(implementation,/storedSignalSnapshotsForWeek/);
  assert.doesNotMatch(implementation,/capturePregameSignalSnapshots|cachedWeeklyOutlookBase|listWeeklyPicks|pick:/);
});

test("Analyst Pack endpoint is public GET and downloads a week-labelled JSON file",()=>{
  const source=readFileSync(new URL("../src/v022-entry.js",import.meta.url),"utf8");
  assert.match(source,/url\.pathname!==['"]\/api\/analyst\/weekly-pack['"]/);
  assert.match(source,/request\.method!==['"]GET['"]/);
  assert.match(source,/buildAnalystPack\(env\.DB,target\.season,target\.week,new Date\(\)\)/);
  assert.match(source,/nfl-\$\{target\.season\}-week-\$\{target\.week\}-analyst-pack\.json/);
});
