import app from './v021-entry.js';
import { fetchNflScores } from './odds.js';
import { ingestCompletedScores, ingestLiveScores } from './results.js';
import { invalidateWeeklyOutlookCache } from './weekly-picks.js';
import { resolveDashboardWeek } from './dashboard-data.js';
import { weekResultsStatus } from './result-sync.js';
import { withV0217DetailGuard } from './v0217-detail-guard.js';

export const APP_VERSION='0.21.8';

function json(body,status=200,headers={}){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
}

function upgradeHtml(body){
  return withV0217DetailGuard(String(body)
    .split('0.21.7').join(APP_VERSION)
    .split('0.21.6').join(APP_VERSION)
    .split("'Update Lines'").join("'Refresh Game Data'")
    .split("'Pull the latest sportsbook spreads. Normally 1 API credit.'").join("'Refresh live scores first, then spreads and moneylines.'")
    .split("action==='spreads'?'⏳ Updating Lines…':'⏳ Checking Final Scores…'").join("action==='spreads'?'⏳ Refreshing Live Scores + Lines…':'⏳ Checking Scores…'")
    .split("try{var b=await sessionRequest(path,{method:'POST'});").join("try{var scores=null;if(action==='spreads')scores=await sessionRequest('/api/ingest/nfl/results',{method:'POST'});var b=await sessionRequest(path,{method:'POST'});")
    .split("action==='spreads'?'Lines Updated':'Final Score Check Complete'").join("action==='spreads'?'Game Data Refreshed':'Score Check Complete'")
    .split("JSON.stringify(b,null,2)").join("JSON.stringify(action==='spreads'?{scores:scores,market:b}:b,null,2)"));
}

function providerSummary(games){
  const rows=Array.isArray(games)?games:[];
  return {
    events:rows.length,
    completed:rows.filter(g=>g?.completed===true).length,
    liveOrUpcoming:rows.filter(g=>g?.completed!==true).length,
    liveGames:rows.filter(g=>g?.completed!==true&&g?.awayScore!==null&&g?.homeScore!==null).map(g=>({
      id:g.id,
      matchup:`${g.awayTeam} @ ${g.homeTeam}`,
      awayScore:g.awayScore,
      homeScore:g.homeScore,
      lastUpdate:g.lastUpdate??null
    })).slice(0,20),
    completedGames:rows.filter(g=>g?.completed===true).map(g=>({
      id:g.id,
      matchup:`${g.awayTeam} @ ${g.homeTeam}`,
      awayScore:g.awayScore,
      homeScore:g.homeScore,
      lastUpdate:g.lastUpdate??null
    })).slice(0,20)
  };
}

async function currentWeekStatus(env){
  if(!env.DB)return null;
  const target=await resolveDashboardWeek(env.DB);
  if(!Number.isInteger(target?.season)||!Number.isInteger(target?.week))return null;
  return weekResultsStatus(env.DB,target.season,target.week,new Date());
}

async function forceManualResultsIfNeeded(request,response,env,url){
  if(request.method!=='POST'||url.pathname!=='/api/ingest/nfl/results'||!response.ok) return response;
  const base=await response.clone().json().catch(()=>null);
  if(!base||!env.DB||!env.ODDS_API_KEY) return response;

  if(base.apiCalled===true){
    const weekStatus=await currentWeekStatus(env).catch(()=>null);
    return json({...base,manualForced:false,weekStatus},response.status,response.headers);
  }

  try{
    const feed=await fetchNflScores({apiKey:env.ODDS_API_KEY,daysFrom:3});
    const liveIngestion=await ingestLiveScores(env.DB,feed.games,new Date());
    const ingestion=await ingestCompletedScores(env.DB,feed.games);
    const finalsChanged=Number(ingestion?.gamesUpdated??0)>0;
    const cacheInvalidated=finalsChanged?await invalidateWeeklyOutlookCache(env.DB):false;
    const weekStatus=await currentWeekStatus(env).catch(()=>null);
    return json({
      ...base,
      apiCalled:true,
      manualForced:true,
      reason:'MANUAL_SCORE_REFRESH',
      quota:feed.quota,
      provider:providerSummary(feed.games),
      liveIngestion,
      ingestion,
      cacheInvalidated,
      weekStatus,
      finalizationVerified:Boolean(weekStatus&&weekStatus.completedGames>0)
    },200,response.headers);
  }catch(error){
    const weekStatus=await currentWeekStatus(env).catch(()=>null);
    return json({...base,manualForced:true,manualForceError:error.message,weekStatus},response.status,response.headers);
  }
}

async function upgrade(request,response,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/health'){
    const b=await response.json().catch(()=>null);
    if(!b||typeof b!=='object') return response;
    return json({...b,version:APP_VERSION,sundayRefreshRecovery:true,manualRefreshIncludesScores:true,manualScoreDiagnostics:true,manualScoreCacheInvalidation:true,liveScoreRefresh:true,canonicalDetailFallback:true},response.status,response.headers);
  }
  if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/app')){
    if(!response.ok) return response;
    return new Response(upgradeHtml(await response.text()),{status:response.status,headers:response.headers});
  }
  if(request.method==='GET'&&url.pathname==='/sw.js'){
    if(!response.ok) return response;
    return new Response(String(await response.text()).split('0.21.7').join(APP_VERSION).split('0.21.6').join(APP_VERSION),{status:response.status,headers:response.headers});
  }
  return forceManualResultsIfNeeded(request,response,env,url);
}

export default{
  async fetch(request,env,ctx){return upgrade(request,await app.fetch(request,env,ctx),env);},
  scheduled(controller,env,ctx){return app.scheduled(controller,env,ctx);}
};
