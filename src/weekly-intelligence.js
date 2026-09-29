import { rankOpportunities } from './opportunity-focus.js';

function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function byGameId(rows=[]){return new Map((rows||[]).map(x=>[String(x.gameId),x]));}

/**
 * Canonical read model for Dashboard, Games, Game Detail and Focus.
 * This is intentionally pure: it accepts already-loaded weekly intelligence
 * and produces one stable payload. Personal picks/survivor state are excluded.
 */
export function buildCanonicalWeeklyPayload({season,week,games=[],focusGames=null,freshness=null,builtAt=new Date().toISOString()}={}){
  const focus=focusGames||rankOpportunities(games);
  const focusBy=byGameId(focus);
  return {
    schemaVersion:'weekly-intelligence/v1',
    season:Number(season),
    week:Number(week),
    builtAt,
    freshness:clone(freshness),
    games:(games||[]).map(g=>({
      gameId:g.gameId,
      awayTeam:g.awayTeam,
      homeTeam:g.homeTeam,
      kickoffAt:g.kickoffAt,
      market:clone(g.market),
      spread:clone(g.spread),
      movement:clone(g.movement),
      history:clone(g.history),
      context:clone(g.context),
      outlook:clone(g.outlook),
      final:clone(g.final),
      focus:clone(focusBy.get(String(g.gameId))||null)
    })),
    contract:{
      oneWeeklyReadModel:true,
      gameNavigationAdditionalIntelligenceReads:0,
      personalPicksEmbedded:false,
      survivorStateEmbedded:false,
      rawHistoricalReads:false,
      fallbackHeavyQuery:false
    }
  };
}

/** Compare the canonical payload to the legacy weekly outlook shape.
 * Used as a migration gate before any production cutover.
 */
export function compareWeeklyParity(payload,legacyGames=[]){
  const legacy=byGameId(legacyGames);
  const mismatches=[];
  for(const g of payload?.games||[]){
    const old=legacy.get(String(g.gameId));
    if(!old){mismatches.push({gameId:g.gameId,field:'game',reason:'missing legacy game'});continue;}
    for(const field of ['awayTeam','homeTeam','kickoffAt'])if(g[field]!==old[field])mismatches.push({gameId:g.gameId,field,expected:old[field],actual:g[field]});
    const checks=[
      ['market.awayMoneyline',g.market?.awayMoneyline,old.market?.awayMoneyline],
      ['market.homeMoneyline',g.market?.homeMoneyline,old.market?.homeMoneyline],
      ['market.awayWinPct',g.market?.awayWinPct,old.market?.awayWinPct],
      ['market.homeWinPct',g.market?.homeWinPct,old.market?.homeWinPct],
      ['spread.away',g.spread?.away,old.spread?.away],
      ['spread.home',g.spread?.home,old.spread?.home],
      ['spread.projectedTeam',g.spread?.projectedTeam,old.spread?.projectedTeam],
      ['spread.coverRate',g.spread?.coverRate,old.spread?.coverRate],
      ['spread.grade',g.spread?.grade,old.spread?.grade],
      ['final.awayScore',g.final?.awayScore,old.final?.awayScore],
      ['final.homeScore',g.final?.homeScore,old.final?.homeScore]
    ];
    for(const [field,a,b] of checks)if((a??null)!==(b??null))mismatches.push({gameId:g.gameId,field,expected:b??null,actual:a??null});
  }
  for(const old of legacyGames||[])if(!(payload?.games||[]).some(g=>String(g.gameId)===String(old.gameId)))mismatches.push({gameId:old.gameId,field:'game',reason:'missing canonical game'});
  return {ok:mismatches.length===0,mismatches};
}

export const READ_BUDGET={
  initialWeeklyArtifactD1Rows:0,
  dashboardToGamesD1Rows:0,
  openSingleGameD1Rows:0,
  openAllGamesD1Rows:0,
  returnToDashboardD1Rows:0
};
