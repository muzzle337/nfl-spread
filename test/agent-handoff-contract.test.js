import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("complete handoff combines the analyst brain, project continuity, and stored evidence",()=>{
  const source=readFileSync(new URL("../src/agent-handoff.js",import.meta.url),"utf8");
  assert.match(source,/NFL_SPREAD_COMPLETE_AGENT_HANDOFF/);
  assert.match(source,/analystBrain:ANALYST_BRAIN/);
  assert.match(source,/projectContinuity:PROJECT_CONTINUITY/);
  assert.match(source,/tierContributorPack/);
  assert.match(source,/signalPerformancePack/);
  assert.match(source,/buildAnalystPack/);
  assert.match(source,/personalPicksIncluded:false/);
  assert.match(source,/storedDataOnly:true/);
  assert.match(source,/oddsApiCalled:false/);
  assert.match(source,/providerCreditsUsed:0/);
  assert.doesNotMatch(source,/fetchNflMarkets|fetchNflScores|ODDS_API_KEY|\/api\/ingest/);
});

test("complete handoff captures the approved analytical and product contracts",()=>{
  const source=readFileSync(new URL("../src/agent-handoff.js",import.meta.url),"utf8");
  assert.match(source,/ATS and outright outcomes are separate/);
  assert.match(source,/not an individual game's cover or win probability/);
  assert.match(source,/Complementary home\/away categories/);
  assert.match(source,/Philadelphia at Chicago/);
  assert.match(source,/Tier Pulse is season-to-date/);
  assert.match(source,/One screen has one canonical renderer/);
  assert.match(source,/Shared-user pick isolation is unresolved/);
  assert.match(source,/Do not overwrite newer agent or developer changes/);
});

test("complete handoff endpoint is a public zero-credit JSON download",()=>{
  const source=readFileSync(new URL("../src/v022-entry.js",import.meta.url),"utf8");
  assert.match(source,/url\.pathname===['"]\/api\/analyst\/complete-handoff['"]/);
  assert.match(source,/buildCompleteAgentHandoff\(env\.DB,target\.season,new Date\(\)\)/);
  assert.match(source,/nfl-\$\{target\.season\}-complete-agent-handoff\.json/);
  assert.match(source,/completeAgentHandoffUsesStoredDataOnly:true/);
  assert.match(source,/completeAgentHandoffProviderCredits:0/);
});
