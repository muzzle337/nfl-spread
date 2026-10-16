import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const base='https://nfl-spread-api.sanro4.workers.dev';
function get(path){
  const body=execFileSync('curl',['-fsS','--max-time','60',base+path],{encoding:'utf8',maxBuffer:20*1024*1024});
  return JSON.parse(body);
}

test('print Week 6 production analyst data',()=>{
  const pack=get('/api/analyst/weekly-pack?season=2026&week=6');
  const dashboard=get('/api/dashboard/nfl?season=2026&week=6');
  const outlooks=pack?.outlooks?.games??[];
  const dashBy=new Map((dashboard.games??[]).map(g=>[String(g.id??g.gameId),g]));
  const compact=outlooks.map(g=>({
    ...g,
    dashboard: (()=>{const d=dashBy.get(String(g.gameId))||{};return {teamRecords:d.teamRecords??null,currentSeasonStats:d.currentSeasonStats??null,grade:d.grade??null,focus:d.focus??null,projectedTeam:d.projectedTeam??null,projectedCoverRate:d.projectedCoverRate??null,sampleSize:d.sampleSize??null};})()
  }));
  console.log('WEEK6_OUTLOOKS='+JSON.stringify(compact));
  console.log('WEEK6_TRENDWATCH='+JSON.stringify(pack?.dashboard?.trendWatch??dashboard?.trendWatch??null));
  console.log('WEEK6_SIGNALPERF='+JSON.stringify(pack?.signalPerformance??null));
  console.log('WEEK6_FOCUS='+JSON.stringify(pack?.focus?.games??[]));
  assert.ok(Array.isArray(outlooks));
});
