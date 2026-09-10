import app from './v019-entry.js';
import { resolveDashboardWeek } from './dashboard-data.js';
import { weeklyGameOutlooks, invalidateWeeklyOutlookCache } from './weekly-picks.js';
import { rankOpportunities } from './opportunity-focus.js';
import { withOpportunityFocusUi } from './opportunity-focus-ui.js';
import { syncResultsIfDue, FINAL_GRACE_HOURS } from './result-sync.js';
import { SPREAD_REFRESH_CRON } from './spread-sync.js';

export const APP_VERSION='0.20.1';
function json(body,status=200,headers={}){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}})}
function replaceVersions(body){return String(body).split('0.12.0').join(APP_VERSION).split('0.13.0').join(APP_VERSION).split('0.13.1').join(APP_VERSION).split('0.13.2').join(APP_VERSION).split('0.13.3').join(APP_VERSION).split('0.14.0').join(APP_VERSION).split('0.15.0').join(APP_VERSION).split('0.16.0').join(APP_VERSION).split('0.17.0').join(APP_VERSION).split('0.17.1').join(APP_VERSION).split('0.18.0').join(APP_VERSION).split('0.18.1').join(APP_VERSION).split('0.18.2').join(APP_VERSION).split('0.19.0').join(APP_VERSION).split('0.19.1').join(APP_VERSION).split('0.20.0').join(APP_VERSION)}
async function target(env,url){const rs=url.searchParams.get('season'),rw=url.searchParams.get('week');const s=rs===null?null:Number(rs),w=rw===null?null:Number(rw);if(Number.isInteger(s)&&Number.isInteger(w))return{season:s,week:w};return resolveDashboardWeek(env.DB)}

async function focusRoute(request,env,url){
  if(url.pathname!=='/api/focus/opportunities')return null;
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  if(!env.DB)return json({error:'Database is not bound'},503);
  try{
    const t=await target(env,url);if(!Number.isInteger(t.season)||!Number.isInteger(t.week))return json({error:'No active NFL week is available'},400);
    const games=await weeklyGameOutlooks(env.DB,t.season,t.week);
    return json({ok:true,season:t.season,week:t.week,games:rankOpportunities(games),principle:'Opportunity and Focus rank independent evidence. They do not create a new win probability.',readSafety:{rawHistoricalGames:false,backgroundPolling:false,weeklyOutlookCache:true}});
  }catch(error){return json({error:'Focus unavailable',message:error.message},400)}
}

async function recordHourlyResultUsage(env,result){
  if(!result?.apiCalled||!env.DB)return;
  try{
    await env.DB.prepare(`INSERT INTO api_usage(provider,request_type,credits_used,credits_remaining,trigger_type,success) VALUES(?,?,?,?,?,1)`).bind(
      'the-odds-api','nfl_results',result.quota?.creditsUsedThisRequest??0,result.quota?.creditsRemaining??null,'scheduled_hourly'
    ).run();
  }catch(error){console.error('Hourly result usage logging failed',error)}
}

async function invalidateIfFinalChanged(env,result){
  if(!env.DB||Number(result?.ingestion?.gamesUpdated??0)<=0)return false;
  await invalidateWeeklyOutlookCache(env.DB);
  return true;
}

async function hourlyResultSync(env,now){
  if(!env.DB||!env.ODDS_API_KEY)return null;
  const result=await syncResultsIfDue({db:env.DB,apiKey:env.ODDS_API_KEY,now});
  await recordHourlyResultUsage(env,result);
  const cacheInvalidated=await invalidateIfFinalChanged(env,result);
  console.log('Hourly result sync',JSON.stringify({apiCalled:result.apiCalled,reason:result.reason,gamesUpdated:result.ingestion?.gamesUpdated??0,cacheInvalidated}));
  return result;
}

async function upgrade(request,response,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/health'){
    const b=await response.json().catch(()=>null);if(!b||typeof b!=='object')return response;
    return json({...b,version:APP_VERSION,opportunityEdgeFocus:true,focusAffectsPredictions:false,focusRawHistoryReads:false,focusBackgroundPolling:false,resultsAutoSync:'hourly_guard_when_final_due_plus_daily_safety',finalGraceHours:FINAL_GRACE_HOURS,resultCacheInvalidation:true},response.status,response.headers);
  }
  if(request.method==='POST'&&url.pathname==='/api/ingest/nfl/results'&&response.ok&&env.DB){
    const payload=await response.clone().json().catch(()=>null);
    if(Number(payload?.ingestion?.gamesUpdated??0)>0)await invalidateWeeklyOutlookCache(env.DB);
    return response;
  }
  if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/app')){
    if(!response.ok)return response;return new Response(withOpportunityFocusUi(replaceVersions(await response.text())),{status:response.status,headers:response.headers});
  }
  if(request.method==='GET'&&url.pathname==='/sw.js'){
    if(!response.ok)return response;return new Response(replaceVersions(await response.text()),{status:response.status,headers:response.headers});
  }
  return response;
}

export default{
  async fetch(request,env,ctx){const url=new URL(request.url);const f=await focusRoute(request,env,url);if(f)return f;return upgrade(request,await app.fetch(request,env,ctx),env);},
  scheduled(controller,env,ctx){
    app.scheduled(controller,env,ctx);
    if((controller.cron??'')===SPREAD_REFRESH_CRON){
      const now=new Date(controller.scheduledTime??Date.now());
      ctx.waitUntil(hourlyResultSync(env,now).catch(error=>console.error('Hourly result sync failed',error)));
    }
  }
};
