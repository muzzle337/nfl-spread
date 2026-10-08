import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTeamRecordsFromGames } from '../src/dashboard-data.js';

function game(id,week,away,home,awayScore,homeScore,status='COMPLETED'){
  return {id,season:2026,week,away_team:away,home_team:home,away_score:awayScore,home_score:homeScore,status};
}

test('team records use completed straight-up results and calculate point differential',()=>{
  const records=buildTeamRecordsFromGames([
    game('w1-dal-nyg',1,'Dallas Cowboys','New York Giants',20,10),
    game('w2-dal-phi',2,'DAL','Philadelphia Eagles',17,24),
    game('w2-phi-nyg',2,'PHI','NYG',21,21),
    game('future',3,'DAL','NYG',null,null,'SCHEDULED')
  ]);

  assert.deepEqual(records.get('DAL'),{
    wins:1,losses:1,ties:0,pointsFor:37,pointsAgainst:34,pointDiff:3
  });
  assert.deepEqual(records.get('PHI'),{
    wins:1,losses:0,ties:1,pointsFor:45,pointsAgainst:38,pointDiff:7
  });
  assert.deepEqual(records.get('NYG'),{
    wins:0,losses:1,ties:1,pointsFor:31,pointsAgainst:41,pointDiff:-10
  });
});

test('team records dedupe the same canonical matchup before counting',()=>{
  const records=buildTeamRecordsFromGames([
    game('duplicate-scheduled',1,'DAL','NYG',null,null,'SCHEDULED'),
    game('canonical-final',1,'Dallas Cowboys','New York Giants',27,17,'COMPLETED')
  ]);
  assert.equal(records.get('DAL').wins,1);
  assert.equal(records.get('DAL').pointsFor,27);
  assert.equal(records.get('NYG').losses,1);
});

test('canonical UI shows straight-up records as context on Dashboard and Games only',()=>{
  const source=fs.readFileSync(new URL('../src/v022-ui.js',import.meta.url),'utf8');
  assert.match(source,/function teamRecordFor\(g,away\)/);
  assert.match(source,/function teamRecordText\(r\)/);
  assert.match(source,/function matchupRecords\(g\)/);
  assert.match(source,/class=\"focus-record\"/);
  assert.match(source,/class=\"team-record\"/);

  const signalStart=source.indexOf('function canonicalCurrentSignal');
  const signalEnd=source.indexOf('function mergedGames',signalStart);
  assert.ok(signalStart>=0&&signalEnd>signalStart);
  assert.doesNotMatch(source.slice(signalStart,signalEnd),/teamRecord/i);
});
