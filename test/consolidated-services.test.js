import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildContextObservations } from '../src/context.js';
import { mergeContextGame, normalizeScheduleRow, teamCode } from '../src/context-sources.js';
import { buildOpportunity, buildOpportunityBoard } from '../src/context-opportunity.js';
import { coachIndicatorSummary, isPrimeTimeGame, normalizeHistoricalGame } from '../src/history.js';
import { currentHistoricalConditions, isCurrentPrimeTime, notableHistoricalSplit } from '../src/history-matchups.js';
import { evaluateOpportunity, rankOpportunities } from '../src/opportunity-focus.js';
import { iconPng, manifestData, serviceWorkerScript } from '../src/pwa.js';
import { outlookLabel } from '../src/weekly-picks.js';

test('context adapters preserve the inputs used by the canonical outlook',()=>{
  assert.equal(teamCode('Buffalo Bills'),'BUF');
  const row=normalizeScheduleRow({
    game_id:'g1',away_team:'BUF',home_team:'MIA',stadium:'Example',roof:'outdoors',
    surface:'grass',away_rest:'7',home_rest:'10',away_coach:'Away Coach',home_coach:'Home Coach',
    away_qb_name:'Away QB',home_qb_name:'Home QB'
  });
  assert.equal(row.awayRest,7);
  assert.equal(row.homeQb,'Home QB');
  const merged=mergeContextGame(
    {away_team:'BUF',home_team:'MIA',stadium:'Primary',away_rest:7},
    {away_team:'BUF',home_team:'MIA',stadium:'Fallback',surface:'grass',home_rest:9}
  );
  assert.equal(merged.stadium,'Primary');
  assert.equal(merged.surface,'grass');
  const observations=buildContextObservations({
    awayCode:'BUF',homeCode:'CLE',awayRest:10,homeRest:6,
    weather:{windMph:19,gustMph:28,temperatureF:30,precipitationProbability:45}
  });
  assert.ok(observations.some(item=>item.label==='Wind'));
  assert.ok(observations.every(item=>!('pick' in item)&&!('probability' in item)));
});

function contextGame(overrides={}){
  return {gameId:'g1',awayCode:'NE',homeCode:'SEA',awayRest:7,homeRest:7,weather:null,awayMetrics:null,homeMetrics:null,quality:{loaded:3,total:9},...overrides};
}

test('context opportunity ranks transparent signals without manufacturing probability',()=>{
  const strong=buildOpportunity(contextGame({
    homeRest:11,weather:{windMph:21,gustMph:36,precipitationProbability:70},
    awayMetrics:{pointDiff:-25,offensiveEpa:-.08,defensiveEpa:.12,successRate:.39},
    homeMetrics:{pointDiff:35,offensiveEpa:.12,defensiveEpa:-.05,successRate:.51},quality:{loaded:9,total:9}
  }));
  assert.equal(strong.level,'HIGH');
  assert.equal(strong.directionalTeam,'SEA');
  assert.equal('probability' in strong,false);
  const board=buildOpportunityBoard([
    contextGame({gameId:'a',weather:{windMph:16}}),
    contextGame({gameId:'b',homeRest:13,weather:{windMph:22,gustMph:38},quality:{loaded:8,total:9}})
  ]);
  assert.equal(board[0].gameId,'b');
});

function focusGame(overrides={}){
  return {
    gameId:'g1',awayTeam:'Buffalo Bills',homeTeam:'Houston Texans',
    market:{awayWinPct:68,homeWinPct:32},spread:{projectedTeam:'Buffalo Bills',coverRate:62,grade:'B',sampleSize:8},
    movement:{direction:'TOWARD_AWAY',movementMagnitude:1},
    history:{away:{notable:[{label:'Road',games:20,winPct:70}]},home:{notable:[]}},
    context:{observations:[{kind:'supporting',label:'Rest edge',side:'AWAY'}]},outlook:{inputs:{historical:'Buffalo Bills'}},...overrides
  };
}

test('Focus preserves independent evidence and explicit conflict',()=>{
  const focused=evaluateOpportunity(focusGame());
  assert.equal(focused.focus,'HIGH');
  assert.equal('probability' in focused,false);
  const conflict=evaluateOpportunity(focusGame({spread:{projectedTeam:'Houston Texans',coverRate:66,grade:'B',sampleSize:8}}));
  assert.ok(conflict.conflict.some(item=>item.team==='Houston Texans'));
  assert.equal(rankOpportunities([focusGame({gameId:'low',market:{awayWinPct:51,homeWinPct:49},spread:{},history:null,context:{observations:[]},outlook:{inputs:{}},movement:null}),focusGame()])[0].gameId,'g1');
});

test('weekly Game Outlook reports agreement without inventing a probability',()=>{
  const good={games:20,record:{winPct:70},spreadRecord:{coverPct:60}};
  const out=outlookLabel(
    {awayTeam:'A',homeTeam:'B',projectedTeam:'B',moneyline:{awayWinProbability:.35,homeWinProbability:.65}},
    {away:{notable:[]},home:{notable:[good]}},null
  );
  assert.equal(out.level,'STRONG AGREEMENT');
  assert.equal(out.team,'B');
  assert.equal('probability' in out,false);
});

function historyRow(overrides={}){
  return {game_id:'g1',season:2024,week:1,game_type:'REG',gameday:'2024-09-08',gametime:'20:20',prime_time:1,away_team:'AAA',home_team:'BBB',away_score:20,home_score:27,result:7,spread_line:3.5,roof:'outdoors',surface:'grass',temp:28,wind:18,away_rest:7,home_rest:10,away_coach:'Away Coach',home_coach:'Home Coach',div_game:1,...overrides};
}

test('historical indicators retain spread, weather, rest and meaningful-sample rules',()=>{
  const normalized=normalizeHistoricalGame(historyRow());
  assert.equal(normalized.spreadLine,3.5);
  assert.equal(normalized.tempF,28);
  assert.equal(isPrimeTimeGame({gametime:'20:20'}),true);
  const summary=coachIndicatorSummary([historyRow(),historyRow({game_id:'g2',home_score:17,away_score:20,result:-3,spread_line:2.5})],'Home Coach');
  assert.equal(summary.overall.games,2);
  assert.equal(isCurrentPrimeTime('2026-09-15T00:15:00Z'),true);
  assert.deepEqual(currentHistoricalConditions({kickoffAt:'2026-09-13T20:25:00Z',roof:'dome',awayRest:7,homeRest:7,weather:{temperatureF:96,windMph:20}}).away,['away']);
  assert.equal(notableHistoricalSplit({games:4,record:{winPct:90},spreadRecord:{coverPct:90}}),false);
  assert.equal(notableHistoricalSplit({games:10,record:{winPct:68},spreadRecord:{coverPct:55}}),true);
});

function pngSize(bytes){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  return {width:view.getUint32(16),height:view.getUint32(20)};
}

test('canonical PWA primitives remain installable, versioned and network-first',()=>{
  const manifest=manifestData();
  assert.equal(manifest.display,'standalone');
  assert.equal(manifest.scope,'/');
  assert.deepEqual(pngSize(iconPng(192)),{width:192,height:192});
  const sw=serviceWorkerScript();
  assert.match(sw,/request\.mode === "navigate"/);
  assert.match(sw,/url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(sw,/skipWaiting/);
});

test('normal reads use stored cache paths and never require retired UI wrappers',()=>{
  const weekly=readFileSync(new URL('../src/weekly-picks.js',import.meta.url),'utf8');
  const history=readFileSync(new URL('../src/history.js',import.meta.url),'utf8');
  assert.match(weekly,/SELECT payload_json,built_at FROM weekly_outlook_cache/);
  assert.match(weekly,/invalidateWeeklyOutlookCache/);
  assert.match(history,/SELECT summary_json,rebuilt_at FROM historical_coach_summaries/);
  assert.ok(history.indexOf('SELECT historical_game_count AS games')<history.indexOf('SELECT * FROM historical_games'));
});
