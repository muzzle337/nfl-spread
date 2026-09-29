import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyCheckpoint } from '../src/weekly-checkpoint.js';

const games = [
  { id:'g1',status:'COMPLETED',away_team:'A',home_team:'B',away_score:24,home_score:17,kickoff_at:'2026-09-20T17:00:00Z' },
  { id:'g2',status:'COMPLETED',away_team:'C',home_team:'D',away_score:7,home_score:10,kickoff_at:'2026-09-20T17:00:00Z' },
  { id:'g3',status:'SCHEDULED',away_team:'E',home_team:'F',away_score:null,home_score:null,kickoff_at:'2026-10-04T17:00:00Z' }
];

test('checkpoint grades stored picks and does not count unplayed games as final', () => {
  const result=weeklyCheckpoint({season:2026,week:3,games,picks:[
    {gameId:'g1',team:'A'},{gameId:'g2',team:'C'}
  ],snapshots:[{gameId:'g1'}],now:'2026-09-28T12:00:00Z'});
  assert.deepEqual(result.counts,{scheduled:3,final:2,upcoming:1,live:0,
    picked:2,unpicked:1,correct:1,wrong:1,tied:0,pending:0,frozenSignals:1});
  assert.equal(result.complete,false);
  assert.equal(result.pickAccuracy,50);
});

test('checkpoint leaves missing finals and missing picks unresolved', () => {
  const result=weeklyCheckpoint({season:2026,week:3,games:[
    {...games[0],status:'IN_PROGRESS',away_score:null,home_score:null}
  ],picks:[{gameId:'g1',team:'A'}],now:'2026-09-28T12:00:00Z'});
  assert.equal(result.counts.live,1);
  assert.equal(result.counts.pending,1);
  assert.equal(result.pickAccuracy,null);
  assert.equal(result.complete,false);
});
