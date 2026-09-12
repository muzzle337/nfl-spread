import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { finalScoreUpdate } from '../src/results.js';
import { buildCurrentSeasonStats } from '../src/projection.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('final score normalization preserves provider kickoff for fallback matching', () => {
  const update = finalScoreUpdate({
    id: 'provider-id',
    completed: true,
    awayTeam: 'New England Patriots',
    homeTeam: 'Seattle Seahawks',
    commenceTime: '2026-09-10T00:20:00Z',
    awayScore: 10,
    homeScore: 13
  });
  assert.equal(update.commenceTime, '2026-09-10T00:20:00Z');
  assert.equal(update.awayScore, 10);
  assert.equal(update.homeScore, 13);
});

test('tier engine still settles favorite and underdog independently', () => {
  const stats = buildCurrentSeasonStats([
    { awaySpread: 3, homeSpread: -3, awayScore: 20, homeScore: 24 },
    { awaySpread: -10, homeSpread: 10, awayScore: 27, homeScore: 20 }
  ]);
  assert.equal(stats.gamesConsidered, 2);
  assert.equal(stats.buckets['HomeFav|<=3'].wins, 1);
  assert.equal(stats.buckets['AwayFav|>7'].losses, 1);
  assert.equal(stats.buckets['HomeDog|>7'].wins, 1);
});

test('production runtime disables recurring pool polling and unconditional cron cache invalidation', () => {
  const v021 = read('../src/v021-entry.js');
  const v018 = read('../src/v018-entry.js');
  assert.match(v021, /legacyRecurringPolling:false/);
  assert.match(v021, /recurring pool polling disabled by core recovery/);
  assert.doesNotMatch(v018, /scheduled\(controller,env,ctx\)[\s\S]*invalidateWeeklyOutlookCache/);
});

test('projection contract supports opening baseline plus live in-week tier state', () => {
  const projection = read('../src/projection.js');
  assert.match(projection, /openingWeekStats/);
  assert.match(projection, /liveWeekStats/);
  assert.match(projection, /completed_current_season_games_before_this_kickoff/);
  assert.match(projection, /week <= \?/);
});

test('score ingestion has team and kickoff fallback when provider ids differ', () => {
  const results = read('../src/results.js');
  assert.match(results, /teams_kickoff/);
  assert.match(results, /away_team = \?/);
  assert.match(results, /home_team = \?/);
  assert.match(results, /julianday\(kickoff_at\)/);
});
