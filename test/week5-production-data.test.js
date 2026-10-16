import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const base='https://nfl-spread-api.sanro4.workers.dev';
function get(path){
  const body=execFileSync('curl',['-fsS','--max-time','60',base+path],{encoding:'utf8',maxBuffer:20*1024*1024});
  return JSON.parse(body);
}
function slimSide(side){return side?{coach:side.coach,overall:side.overall,notable:side.notable}:null}

test('print Week 6 production analyst data',()=>{
  const pack=get('/api/analyst/weekly-pack?season=2026&week=6');
  const dashboard=get('/api/dashboard/nfl?season=2026&week=6');
  const outlooks=pack?.outlooks?.games??[];
  const dashBy=new Map((dashboard.games??[]).map(g=>[String(g.id??g.gameId),g]));
  for(const g of outlooks){
    const d=dashBy.get(String(g.gameId))||{};
    const m=g.movement||{};
    console.log('W6GAME='+JSON.stringify({
      gameId:g.gameId,awayTeam:g.awayTeam,homeTeam:g.homeTeam,kickoffAt:g.kickoffAt,
      classification:g.classification,spread:g.spread,market:g.market,
      movement:{openAway:m.firstCapturedAwaySpread,openHome:m.firstCapturedHomeSpread,currentAway:m.currentAwaySpread,currentHome:m.currentHomeSpread,magnitude:m.movementMagnitude,direction:m.direction,books:m.bookmakerCount,changedBooks:m.changedBookmakers,alignment:m.marketAlignment,moneyline:m.moneyline?{openAway:m.moneyline.openingAwayMoneyline,openHome:m.moneyline.openingHomeMoneyline,currentAway:m.moneyline.currentAwayMoneyline,currentHome:m.moneyline.currentHomeMoneyline,openAwayPct:m.moneyline.openingAwayNoVigProbability,openHomePct:m.moneyline.openingHomeNoVigProbability,currentAwayPct:m.moneyline.currentAwayNoVigProbability,currentHomePct:m.moneyline.currentHomeNoVigProbability,probabilityMagnitude:m.moneyline.probabilityMagnitude,direction:m.moneyline.direction,changedBooks:m.moneyline.changedBookmakers}:null},
      history:g.history?{away:slimSide(g.history.away),home:slimSide(g.history.home),evidence:g.history.evidence,situational:g.history.situational,evidenceSummary:g.history.evidenceSummary,situationalSummary:g.history.situationalSummary}:null,
      context:g.context,outlook:g.outlook,poolEdge:g.poolEdge,openingSignal:g.openingSignal,currentSignal:g.currentSignal,signalChange:g.signalChange,
      teamRecords:d.teamRecords??null,currentSeasonStats:d.currentSeasonStats??null,grade:d.grade??null,focus:d.focus??null,projectedTeam:d.projectedTeam??null,projectedCoverRate:d.projectedCoverRate??null,sampleSize:d.sampleSize??null
    }));
  }
  console.log('W6TREND='+JSON.stringify(pack?.dashboard?.trendWatch??dashboard?.trendWatch??null));
  console.log('W6SIG='+JSON.stringify(pack?.signalPerformance??null));
  console.log('W6FOCUS='+JSON.stringify(pack?.focus?.games??[]));
  assert.equal(outlooks.length,14);
});
