import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const base='https://nfl-spread-api.sanro4.workers.dev';
function get(path){
  const body=execFileSync('curl',['-fsS','--max-time','45',base+path],{encoding:'utf8'});
  return JSON.parse(body);
}

test('print Week 5 production movement and dashboard data',()=>{
  const movement=get('/api/lines/movement/dashboard?season=2026&week=5');
  const dashboard=get('/api/dashboard/nfl?season=2026&week=5');
  const moves=movement.movements??[];
  const qualifying=moves.filter(m=>Number.isFinite(m.movementMagnitude)&&Math.abs(m.movementMagnitude)>=1);
  const ids=new Set(qualifying.map(m=>String(m.gameId)));
  const games=(dashboard.games??[]).filter(g=>ids.has(String(g.gameId??g.id)));
  console.log('WEEK5_MOVEMENTS='+JSON.stringify(qualifying));
  console.log('WEEK5_DASHBOARD_GAMES='+JSON.stringify(games));
  console.log('DASHBOARD_GAME_KEYS='+JSON.stringify(Object.keys((dashboard.games??[])[0]??{}).sort()));
  assert.ok(Array.isArray(moves));
});
