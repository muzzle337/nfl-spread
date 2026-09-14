import coreApp from './index.js';
import {
  adminSessionCookie,
  clearAdminSessionCookie,
  createAdminSession,
  isAdminSessionAuthorized
} from './admin-session.js';
import { resolveDashboardWeek } from './dashboard-data.js';
import { dataFreshness } from './data-freshness.js';
import { d1CacheStatus, rebuildStoredHistoricalSummaries } from './d1-usage.js';
import { contextForWeek, syncContext } from './context.js';
import { buildOpportunityBoard } from './context-opportunity.js';
import { ensureContextSchema } from './context-schema.js';
import { historicalCoachIndicators, historyStatus, importHistoricalGames } from './history.js';
import { historicalIndicatorsForWeek } from './history-matchups.js';
import { ingestWeeklySpreads } from './ingestion.js';
import { lineMovementForGame, lineMovementsForWeek } from './line-movement.js';
import { fetchNflMarkets, fetchNflScores } from './odds.js';
import { rankOpportunities } from './opportunity-focus.js';
import { iconPng, manifestData, serviceWorkerScript } from './pwa.js';
import { ingestCompletedScores, ingestLiveScores } from './results.js';
import { FINAL_GRACE_HOURS, syncResultsIfDue, weekResultsStatus } from './result-sync.js';
import { SPREAD_REFRESH_CRON } from './spread-sync.js';
import {
  invalidateWeeklyOutlookCache,
  poolSeasonSummary,
  saveWeeklyPick,
  weeklyGameOutlooks
} from './weekly-picks.js';
import { APP_VERSION, canonicalAppPage } from './v022-ui.js';

const RESULTS_REFRESH_CRON='15 12 * * *';
const corsHeaders={
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers':'content-type,x-admin-token'
};

function json(body,status=200,headers={}){
  return new Response(JSON.stringify(body),{
    status,
    headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...corsHeaders,...headers}
  });
}

function html(body,status=200){
  return new Response(body,{
    status,
    headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store, no-cache, must-revalidate',pragma:'no-cache',expires:'0'}
  });
}

function text(body,type,headers={}){
  return new Response(body,{status:200,headers:{'content-type':type,...headers}});
}

function image(bytes){
  return new Response(bytes,{status:200,headers:{'content-type':'image/png','cache-control':'public, max-age=86400'}});
}

function errorStatus(error,fallback=502){
  return error?.status>=400&&error?.status<600?error.status:fallback;
}

async function logApiUsage(env,{requestType,quota,triggerType='manual',success=true}){
  if(!env.DB)return;
  try{
    await env.DB.prepare('INSERT INTO api_usage(provider,request_type,credits_used,credits_remaining,trigger_type,success) VALUES(?,?,?,?,?,?)')
      .bind('the-odds-api',requestType,quota?.creditsUsedThisRequest??0,quota?.creditsRemaining??null,triggerType,success?1:0).run();
  }catch(error){console.error('API usage logging failed',error)}
}

async function targetWeek(env,url){
  const season=Number(url.searchParams.get('season'));
  const week=Number(url.searchParams.get('week'));
  if(Number.isInteger(season)&&Number.isInteger(week)&&week>0)return {season,week};
  if(!env.DB)return {season:null,week:null};
  return resolveDashboardWeek(env.DB);
}

async function requireAdmin(request,env){
  return isAdminSessionAuthorized(request,env);
}

async function adminSessionRoute(request,env,url){
  if(url.pathname!=='/api/admin/session')return null;
  if(request.method==='POST'){
    const body=await request.json().catch(()=>({}));
    const result=await createAdminSession(body.pin,env);
    if(!result.ok)return json({error:result.error},result.status);
    return json({ok:true,authenticated:true,expiresInSeconds:result.expiresInSeconds},200,{'set-cookie':adminSessionCookie(result.token)});
  }
  if(request.method==='GET'){
    const auth=await isAdminSessionAuthorized(request,env);
    return json({ok:true,configured:Boolean(env.ADMIN_UI_PIN&&env.INGEST_ADMIN_TOKEN),authenticated:auth.ok,expiresAt:auth.ok?auth.expiresAt??null:null});
  }
  if(request.method==='DELETE')return json({ok:true,authenticated:false},200,{'set-cookie':clearAdminSessionCookie()});
  return json({error:'Method not allowed'},405);
}

async function marketRoute(request,env,url){
  if(url.pathname==='/api/odds/nfl'&&request.method==='GET'){
    if(!env.ODDS_API_KEY)return json({error:'Odds API is not configured'},503);
    try{
      const result=await fetchNflMarkets({apiKey:env.ODDS_API_KEY});
      await logApiUsage(env,{requestType:'nfl_markets',quota:result.quota,success:true});
      return json({ok:true,fetchedAt:new Date().toISOString(),gameCount:result.games.length,quota:result.quota,games:result.games});
    }catch(error){
      await logApiUsage(env,{requestType:'nfl_markets',quota:error.quota,success:false});
      return json({error:'Unable to fetch NFL markets',message:error.message,quota:error.quota??null},errorStatus(error));
    }
  }

  if(url.pathname==='/api/ingest/nfl'&&request.method==='POST'){
    const auth=await requireAdmin(request,env);
    if(!auth.ok)return json({error:auth.error},auth.status);
    if(!env.ODDS_API_KEY)return json({error:'Odds API is not configured'},503);
    if(!env.DB)return json({error:'Database is not bound'},503);
    try{
      const result=await fetchNflMarkets({apiKey:env.ODDS_API_KEY});
      const ingestion=await ingestWeeklySpreads(env.DB,result.games,new Date());
      await invalidateWeeklyOutlookCache(env.DB);
      await logApiUsage(env,{requestType:'nfl_ingest',quota:result.quota,triggerType:'admin_page',success:true});
      return json({ok:true,fetchedAt:new Date().toISOString(),quota:result.quota,ingestion,cacheInvalidated:true});
    }catch(error){
      await logApiUsage(env,{requestType:'nfl_ingest',quota:error.quota,triggerType:'admin_page',success:false});
      return json({error:'Unable to ingest NFL markets',message:error.message,quota:error.quota??null},errorStatus(error));
    }
  }
  return null;
}

function providerSummary(games){
  const rows=Array.isArray(games)?games:[];
  const row=(g)=>({id:g.id,matchup:String(g.awayTeam)+' @ '+String(g.homeTeam),awayScore:g.awayScore,homeScore:g.homeScore,lastUpdate:g.lastUpdate??null});
  return {
    events:rows.length,
    completed:rows.filter(g=>g?.completed===true).length,
    liveOrUpcoming:rows.filter(g=>g?.completed!==true).length,
    liveGames:rows.filter(g=>g?.completed!==true&&g?.awayScore!==null&&g?.homeScore!==null).map(row).slice(0,20),
    completedGames:rows.filter(g=>g?.completed===true).map(row).slice(0,20)
  };
}

async function manualResultsRoute(request,env,url){
  if(url.pathname!=='/api/ingest/nfl/results'||request.method!=='POST')return null;
  const auth=await requireAdmin(request,env);
  if(!auth.ok)return json({error:auth.error},auth.status);
  if(!env.ODDS_API_KEY)return json({error:'Odds API is not configured'},503);
  if(!env.DB)return json({error:'Database is not bound'},503);

  try{
    const now=new Date();
    const feed=await fetchNflScores({apiKey:env.ODDS_API_KEY,daysFrom:3});
    const liveIngestion=await ingestLiveScores(env.DB,feed.games,now);
    const ingestion=await ingestCompletedScores(env.DB,feed.games);
    const changed=Number(ingestion?.gamesUpdated??0)>0;
    const cacheInvalidated=changed?await invalidateWeeklyOutlookCache(env.DB):false;
    const target=await resolveDashboardWeek(env.DB);
    const weekStatus=Number.isInteger(target?.season)&&Number.isInteger(target?.week)
      ?await weekResultsStatus(env.DB,target.season,target.week,now):null;
    await logApiUsage(env,{requestType:'nfl_results',quota:feed.quota,triggerType:'admin_page',success:true});
    return json({
      ok:true,
      checkedAt:now.toISOString(),
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
    });
  }catch(error){
    await logApiUsage(env,{requestType:'nfl_results',quota:error.quota,triggerType:'admin_page',success:false});
    return json({error:'Unable to ingest NFL results',message:error.message,quota:error.quota??null},errorStatus(error));
  }
}

async function poolRoute(request,env,url){
  if(!url.pathname.startsWith('/api/pool/'))return null;
  if(!env.DB)return json({error:'Database is not bound'},503);
  if(url.pathname==='/api/pool/outlooks'&&request.method==='GET'){
    const target=await targetWeek(env,url);
    if(!Number.isInteger(target.season)||!Number.isInteger(target.week))return json({error:'No active NFL week is available'},400);
    try{
      const [games,summary]=await Promise.all([
        weeklyGameOutlooks(env.DB,target.season,target.week),
        poolSeasonSummary(env.DB,target.season)
      ]);
      return json({
        ok:true,season:target.season,week:target.week,games,summary,
        principle:'Game Outlook explains agreement and conflict across market, current-season spread, history and context. It does not manufacture a new probability.',
        percentageLabel:'market_no_vig_win_probability'
      });
    }catch(error){return json({error:'Game Outlook unavailable',message:error.message},400)}
  }
  if(url.pathname==='/api/pool/picks'&&request.method==='POST'){
    const auth=await requireAdmin(request,env);
    if(!auth.ok)return json({error:auth.error},auth.status);
    const body=await request.json().catch(()=>({}));
    try{return json({ok:true,pick:await saveWeeklyPick(env.DB,body)})}
    catch(error){return json({error:'Unable to save weekly pick',message:error.message},400)}
  }
  return json({error:'Method not allowed'},405);
}

async function focusRoute(request,env,url){
  if(url.pathname!=='/api/focus/opportunities')return null;
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  if(!env.DB)return json({error:'Database is not bound'},503);
  try{
    const target=await targetWeek(env,url);
    if(!Number.isInteger(target.season)||!Number.isInteger(target.week))return json({error:'No active NFL week is available'},400);
    const games=await weeklyGameOutlooks(env.DB,target.season,target.week);
    return json({
      ok:true,season:target.season,week:target.week,games:rankOpportunities(games),
      principle:'Opportunity and Focus rank independent evidence. They do not create a new win probability.',
      readSafety:{rawHistoricalGames:false,backgroundPolling:false,weeklyOutlookCache:true}
    });
  }catch(error){return json({error:'Focus unavailable',message:error.message},400)}
}

async function freshnessRoute(request,env,url){
  if(url.pathname!=='/api/data/freshness')return null;
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  if(!env.DB)return json({error:'Database is not bound'},503);
  try{
    return json({ok:true,...await dataFreshness(env.DB,{season:url.searchParams.get('season'),week:url.searchParams.get('week'),now:new Date()})});
  }catch(error){return json({error:'Freshness unavailable',message:error.message},400)}
}

async function contextRoute(request,env,url){
  if(!url.pathname.startsWith('/api/context/'))return null;
  if(!env.DB)return json({error:'Database is not bound'},503);
  const target=await targetWeek(env,url);
  if(!Number.isInteger(target.season)||!Number.isInteger(target.week))return json({error:'No active NFL week is available'},400);

  if(url.pathname==='/api/context/nfl'&&request.method==='GET'){
    try{
      await ensureContextSchema(env.DB);
      return json({ok:true,...await contextForWeek(env.DB,target.season,target.week)});
    }catch(error){return json({error:'Context unavailable',message:error.message},400)}
  }

  if(url.pathname==='/api/context/sync'&&request.method==='POST'){
    const auth=await requireAdmin(request,env);
    if(!auth.ok)return json({error:auth.error},auth.status);
    try{
      const result=await syncContext(env.DB,target.season,target.week);
      await invalidateWeeklyOutlookCache(env.DB,target.season,target.week);
      return json({ok:true,...result,cacheInvalidated:true});
    }catch(error){return json({error:'Context sync failed',message:error.message},502)}
  }

  if(url.pathname==='/api/context/opportunities'&&request.method==='GET'){
    try{
      await ensureContextSchema(env.DB);
      const context=await contextForWeek(env.DB,target.season,target.week);
      return json({
        ok:true,season:target.season,week:target.week,games:context.games,
        opportunities:buildOpportunityBoard(context.games),lastSync:context.lastSync,principle:context.principle,
        scoringPrinciple:'Opportunity score counts transparent context signals. It is not a betting probability and does not modify spread outputs.'
      });
    }catch(error){return json({error:'Context opportunities unavailable',message:error.message},400)}
  }

  return json({error:'Method not allowed'},405);
}

async function historyRoute(request,env,url){
  if(!url.pathname.startsWith('/api/history/'))return null;
  if(!env.DB)return json({error:'Database is not bound'},503);

  if(url.pathname==='/api/history/status'&&request.method==='GET'){
    try{return json({ok:true,...await historyStatus(env.DB)})}
    catch(error){return json({error:'Historical status unavailable',message:error.message},400)}
  }

  if(url.pathname==='/api/history/coach'&&request.method==='GET'){
    const coach=url.searchParams.get('coach')?.trim();
    if(!coach)return json({error:'coach is required'},400);
    try{
      return json({ok:true,...await historicalCoachIndicators(env.DB,coach,{startSeason:Number(url.searchParams.get('start')||2015),endSeason:Number(url.searchParams.get('end')||2025)})});
    }catch(error){return json({error:'Historical coach indicators unavailable',message:error.message},400)}
  }

  if(url.pathname==='/api/history/import'&&request.method==='POST'){
    const auth=await requireAdmin(request,env);
    if(!auth.ok)return json({error:auth.error},auth.status);
    try{
      const result=await importHistoricalGames(env.DB,{startSeason:Number(url.searchParams.get('start')||2015),endSeason:Number(url.searchParams.get('end')||2025)});
      await invalidateWeeklyOutlookCache(env.DB);
      return json({ok:true,...result,cacheInvalidated:true});
    }catch(error){return json({error:'Historical import failed',message:error.message},502)}
  }

  if(url.pathname==='/api/history/matchups'&&request.method==='GET'){
    const target=await targetWeek(env,url);
    if(!Number.isInteger(target.season)||!Number.isInteger(target.week))return json({error:'No active NFL week is available'},400);
    const startSeason=Number(url.searchParams.get('start')||2015),endSeason=Number(url.searchParams.get('end')||2025);
    try{
      await ensureContextSchema(env.DB);
      const context=await contextForWeek(env.DB,target.season,target.week);
      const games=await historicalIndicatorsForWeek(env.DB,context.games,{startSeason,endSeason});
      return json({ok:true,season:target.season,week:target.week,range:{startSeason,endSeason},games,principle:'Historical indicators explain comparable coaching situations without modifying current-season spread probabilities.'});
    }catch(error){return json({error:'Historical matchup indicators unavailable',message:error.message},400)}
  }

  return json({error:'Method not allowed'},405);
}

async function cacheRoute(request,env,url){
  if(!url.pathname.startsWith('/api/cache/'))return null;
  if(!env.DB)return json({error:'Database is not bound'},503);
  if(url.pathname==='/api/cache/status'&&request.method==='GET'){
    try{return json({ok:true,...await d1CacheStatus(env.DB,Number(url.searchParams.get('season')),Number(url.searchParams.get('week')))})}
    catch(error){return json({error:'Cache status unavailable',message:error.message},400)}
  }
  if(url.pathname==='/api/cache/history/rebuild'&&request.method==='POST'){
    const auth=await requireAdmin(request,env);
    if(!auth.ok)return json({error:auth.error},auth.status);
    try{
      const result=await rebuildStoredHistoricalSummaries(env.DB,{startSeason:Number(url.searchParams.get('start')||2015),endSeason:Number(url.searchParams.get('end')||2025)});
      await invalidateWeeklyOutlookCache(env.DB);
      return json({ok:true,...result,weeklyOutlookCacheInvalidated:true});
    }catch(error){return json({error:'Historical summary cache rebuild failed',message:error.message},400)}
  }
  return json({error:'Method not allowed'},405);
}

async function lineRoute(request,env,url){
  if(!url.pathname.startsWith('/api/lines/movement'))return null;
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  if(!env.DB)return json({error:'Database is not bound'},503);
  try{
    if(url.pathname==='/api/lines/movement'){
      const gameId=url.searchParams.get('game');
      if(!gameId)return json({error:'game is required'},400);
      const movement=await lineMovementForGame(env.DB,gameId);
      return movement?json({ok:true,movement}):json({error:'Game not found'},404);
    }
    if(url.pathname==='/api/lines/movement/dashboard'){
      const target=await targetWeek(env,url);
      const movements=Number.isInteger(target.season)&&Number.isInteger(target.week)
        ?await lineMovementsForWeek(env.DB,target.season,target.week):[];
      return json({ok:true,season:target.season,week:target.week,movements});
    }
  }catch(error){return json({error:'Line movement unavailable',message:error.message},400)}
  return json({error:'Not found'},404);
}

async function stabilityRoute(request,env,url){
  if(url.pathname!=='/api/stability/contracts'||request.method!=='GET')return null;
  let database='unbound';
  if(env.DB){
    try{await env.DB.prepare('SELECT 1').first();database='ok'}catch{database='error'}
  }
  const checks=[
    {path:'/api/health',status:200,ok:true,validJson:true},
    {path:'/api/dashboard/nfl',status:env.DB?200:503,ok:database==='ok',validJson:true}
  ];
  return json({ok:checks.every(x=>x.ok),version:APP_VERSION,checks,deferredHeavyContracts:['/api/context/opportunities','/api/history/matchups','/api/pool/outlooks'],principle:'Diagnostics stay lightweight and do not trigger historical calculations.'});
}

async function healthRoute(env){
  let database='unbound';
  if(env.DB){
    try{await env.DB.prepare('SELECT 1').first();database='ok'}catch{database='error'}
  }
  return json({
    ok:true,
    service:'nfl-spread-api',
    version:APP_VERSION,
    database,
    oddsApiConfigured:Boolean(env.ODDS_API_KEY),
    adminIngestConfigured:Boolean(env.INGEST_ADMIN_TOKEN),
    canonicalShell:true,
    canonicalBackendRouter:true,
    canonicalScreens:['dashboard','games','picks','tools'],
    survivorActive:false,
    legacyEntryDelegation:false,
    legacyUiInjection:false,
    legacyRecurringPolling:false,
    uiRuntimePolling:false,
    weeklyPoolPicks:true,
    weeklyPoolGrading:true,
    imessageExport:true,
    publicPickPercentage:false,
    contextIntelligence:true,
    historicalIndicators:true,
    historicalMatchupBridge:true,
    opportunityEdgeFocus:true,
    focusAffectsPredictions:false,
    normalUiRawHistoryReads:false,
    weeklyOutlookCache:true,
    dataFreshnessContract:true,
    finalScoreProminent:true,
    tierPercentVisibleOnCards:true,
    gameCardStatusFirst:true,
    teamScoresInline:true,
    finalCardsPostgameOnly:true,
    finalCardPostgameStats:true,
    manualRefreshIncludesScores:true,
    manualScoreDiagnostics:true,
    manualScoreCacheInvalidation:true,
    liveScoreRefresh:true,
    resultsAutoSync:'hourly_guard_when_final_due_plus_daily_safety',
    spreadAutoSync:'hourly_guard_adaptive_24h_12h_6h_2h',
    finalGraceHours:FINAL_GRACE_HOURS
  });
}

function recoveryResponse(request){
  const target=new URL(request.url);
  target.pathname='/';
  target.search='';
  target.searchParams.set('recovered','1');
  target.searchParams.set('v',APP_VERSION);
  return new Response(null,{status:302,headers:{location:target.toString(),'clear-site-data':'"cache", "storage"','cache-control':'no-store, no-cache, must-revalidate',pragma:'no-cache',expires:'0'}});
}

function serviceWorker(){
  const script=serviceWorkerScript().replace('0.7.0',APP_VERSION);
  return script+"\nself.addEventListener('message',function(event){if(!event.data||event.data.type!=='GET_VERSION')return;var payload={type:'VERSION',version:'"+APP_VERSION+"'};if(event.ports&&event.ports[0])event.ports[0].postMessage(payload);else if(event.source&&event.source.postMessage)event.source.postMessage(payload)});";
}

async function recordHourlyResultUsage(env,result){
  if(!result?.apiCalled)return;
  await logApiUsage(env,{requestType:'nfl_results',quota:result.quota,triggerType:'scheduled_hourly',success:true});
}

async function invalidateIfFinalChanged(env,result){
  const changed=Number(result?.ingestion?.gamesUpdated??0)+Number(result?.staleRepair?.repaired??0);
  if(!env.DB||changed<=0)return false;
  await invalidateWeeklyOutlookCache(env.DB);
  return true;
}

async function hourlyResultSync(env,now){
  if(!env.DB||!env.ODDS_API_KEY)return null;
  const result=await syncResultsIfDue({db:env.DB,apiKey:env.ODDS_API_KEY,now});
  await recordHourlyResultUsage(env,result);
  const cacheInvalidated=await invalidateIfFinalChanged(env,result);
  console.log('Hourly result sync',JSON.stringify({apiCalled:result.apiCalled,reason:result.reason,gamesUpdated:result.ingestion?.gamesUpdated??0,staleRepaired:result.staleRepair?.repaired??0,cacheInvalidated}));
  return result;
}

export default{
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders});
    const url=new URL(request.url);

    if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/app'))return html(canonicalAppPage());
    if(request.method==='GET'&&url.pathname==='/recover')return recoveryResponse(request);
    if(request.method==='GET'&&url.pathname==='/manifest.webmanifest')return text(JSON.stringify(manifestData()),'application/manifest+json; charset=utf-8',{'cache-control':'no-cache'});
    if(request.method==='GET'&&url.pathname==='/sw.js')return text(serviceWorker(),'application/javascript; charset=utf-8',{'cache-control':'no-cache, no-store, must-revalidate','service-worker-allowed':'/'});
    if(request.method==='GET'&&url.pathname==='/icons/icon-192.png')return image(iconPng(192));
    if(request.method==='GET'&&url.pathname==='/icons/icon-512.png')return image(iconPng(512));
    if(request.method==='GET'&&url.pathname==='/icons/apple-touch-icon.png')return image(iconPng(180));
    if(url.pathname==='/api/health')return healthRoute(env);

    const routes=[
      adminSessionRoute,
      manualResultsRoute,
      marketRoute,
      poolRoute,
      focusRoute,
      freshnessRoute,
      contextRoute,
      historyRoute,
      cacheRoute,
      lineRoute,
      stabilityRoute
    ];

    for(const route of routes){
      const response=await route(request,env,url,ctx);
      if(response)return response;
    }

    if(url.pathname.startsWith('/api/survivor'))return json({error:'Survivor is inactive in v0.22'},410);

    return coreApp.fetch(request,env,ctx);
  },

  scheduled(controller,env,ctx){
    coreApp.scheduled(controller,env,ctx);
    if((controller.cron??'')===SPREAD_REFRESH_CRON){
      const now=new Date(controller.scheduledTime??Date.now());
      ctx.waitUntil(hourlyResultSync(env,now).catch(error=>console.error('Hourly result sync failed',error)));
    }
  }
};
