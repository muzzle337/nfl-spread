import app from './v021-entry.js';
import { fetchNflScores } from './odds.js';
import { ingestCompletedScores } from './results.js';
import { withV0217DetailGuard } from './v0217-detail-guard.js';

export const APP_VERSION='0.21.7';

function json(body,status=200,headers={}){
  return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
}

function upgradeHtml(body){
  return withV0217DetailGuard(String(body)
    .split('0.21.6').join(APP_VERSION)
    .split("'Update Lines'").join("'Refresh Game Data'")
    .split("'Pull the latest sportsbook spreads. Normally 1 API credit.'").join("'Check finished scores first, then refresh spreads and moneylines.'")
    .split("action==='spreads'?'⏳ Updating Lines…':'⏳ Checking Final Scores…'").join("action==='spreads'?'⏳ Refreshing Scores + Lines…':'⏳ Checking Final Scores…'")
    .split("try{var b=await sessionRequest(path,{method:'POST'});").join("try{var scores=null;if(action==='spreads')scores=await sessionRequest('/api/ingest/nfl/results',{method:'POST'});var b=await sessionRequest(path,{method:'POST'});")
    .split("action==='spreads'?'Lines Updated':'Final Score Check Complete'").join("action==='spreads'?'Game Data Refreshed':'Final Score Check Complete'")
    .split("JSON.stringify(b,null,2)").join("JSON.stringify(action==='spreads'?{scores:scores,market:b}:b,null,2)"));
}

async function forceManualResultsIfNeeded(request,response,env,url){
  if(request.method!=='POST'||url.pathname!=='/api/ingest/nfl/results'||!response.ok) return response;
  const base=await response.clone().json().catch(()=>null);
  if(!base||base.apiCalled===true||!env.DB||!env.ODDS_API_KEY) return response;
  try{
    const feed=await fetchNflScores({apiKey:env.ODDS_API_KEY,daysFrom:3});
    const ingestion=await ingestCompletedScores(env.DB,feed.games);
    return json({...base,apiCalled:true,manualForced:true,reason:'MANUAL_SCORE_REFRESH',quota:feed.quota,ingestion},200,response.headers);
  }catch(error){
    return json({...base,manualForced:true,manualForceError:error.message},response.status,response.headers);
  }
}

async function upgrade(request,response,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/health'){
    const b=await response.json().catch(()=>null);
    if(!b||typeof b!=='object') return response;
    return json({...b,version:APP_VERSION,sundayRefreshRecovery:true,manualRefreshIncludesScores:true,canonicalDetailFallback:true},response.status,response.headers);
  }
  if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/app')){
    if(!response.ok) return response;
    return new Response(upgradeHtml(await response.text()),{status:response.status,headers:response.headers});
  }
  if(request.method==='GET'&&url.pathname==='/sw.js'){
    if(!response.ok) return response;
    return new Response(String(await response.text()).split('0.21.6').join(APP_VERSION),{status:response.status,headers:response.headers});
  }
  return forceManualResultsIfNeeded(request,response,env,url);
}

export default{
  async fetch(request,env,ctx){return upgrade(request,await app.fetch(request,env,ctx),env);},
  scheduled(controller,env,ctx){return app.scheduled(controller,env,ctx);}
};
