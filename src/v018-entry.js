import app from "./v017-entry.js";
import { withStabilityUi } from "./stability-ui.js";
import { isAdminSessionAuthorized } from "./admin-session.js";
import { invalidateWeeklyOutlookCache } from "./weekly-picks.js";
import { d1CacheStatus, rebuildStoredHistoricalSummaries } from "./d1-usage.js";

export const APP_VERSION="0.18.2";
function json(body,status=200,headers={}){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}})}
function replaceVersions(body){return String(body).split("0.12.0").join(APP_VERSION).split("0.13.0").join(APP_VERSION).split("0.13.1").join(APP_VERSION).split("0.13.2").join(APP_VERSION).split("0.13.3").join(APP_VERSION).split("0.14.0").join(APP_VERSION).split("0.15.0").join(APP_VERSION).split("0.16.0").join(APP_VERSION).split("0.17.0").join(APP_VERSION).split("0.17.1").join(APP_VERSION).split("0.18.0").join(APP_VERSION).split("0.18.1").join(APP_VERSION)}

async function inspect(request,env,ctx,path){
  try{
    const url=new URL(request.url);url.pathname=path;url.search='';
    const r=await app.fetch(new Request(url.toString(),{method:'GET',headers:{accept:'application/json'}}),env,ctx);
    const text=await r.text();let body=null,validJson=true;
    try{body=JSON.parse(text)}catch{validJson=false}
    return {path,status:r.status,ok:r.ok,validJson,contentType:r.headers.get('content-type')||'',error:body&&body.error||null,message:body&&body.message||null};
  }catch(error){return {path,status:0,ok:false,validJson:false,error:'exception',message:String(error&&error.message||error)}}
}

async function stabilityRoute(request,env,ctx,url){
  if(url.pathname!=='/api/stability/contracts'||request.method!=='GET')return null;
  const paths=['/api/health','/api/dashboard/nfl'];
  const checks=[];for(const path of paths)checks.push(await inspect(request,env,ctx,path));
  return json({ok:checks.every(x=>x.ok&&x.validJson),version:APP_VERSION,checks,deferredHeavyContracts:['/api/context/opportunities','/api/history/matchups','/api/pool/outlooks'],principle:'Diagnostics stay lightweight and do not trigger heavy historical or weekly outlook calculations.'});
}

async function cacheRoute(request,env,url){
  if(!url.pathname.startsWith('/api/cache/'))return null;
  if(!env.DB)return json({error:'Database is not bound'},503);
  if(url.pathname==='/api/cache/status'&&request.method==='GET'){
    try{return json({ok:true,...await d1CacheStatus(env.DB,Number(url.searchParams.get('season')),Number(url.searchParams.get('week')))});}catch(error){return json({error:'Cache status unavailable',message:error.message},400)}
  }
  if(url.pathname==='/api/cache/history/rebuild'&&request.method==='POST'){
    const auth=await isAdminSessionAuthorized(request,env);if(!auth.ok)return json({error:auth.error},auth.status);
    const startSeason=Number(url.searchParams.get('start')||2015),endSeason=Number(url.searchParams.get('end')||2025);
    try{return json({ok:true,...await rebuildStoredHistoricalSummaries(env.DB,{startSeason,endSeason})});}catch(error){return json({error:'Historical summary cache rebuild failed',message:error.message},400)}
  }
  return json({error:'Method not allowed'},405);
}

function invalidatesWeeklyOutlook(request,url,response){
  if(request.method!=='POST'||!response.ok||url.pathname==='/api/pool/picks')return false;
  return url.pathname==='/api/context/sync'||url.pathname==='/api/history/import'||url.pathname.includes('/sync')||url.pathname.includes('/ingest');
}

async function upgrade(request,response){
  const url=new URL(request.url);
  if(url.pathname==='/api/health'){
    const body=await response.json().catch(()=>null);if(!body||typeof body!=='object')return response;
    return json({...body,version:APP_VERSION,stabilityAudit:true,viewIsolation:true,uiDedupeGuard:true,contractDiagnostics:true,browserRegressionGate:true,d1ReadHotfix:true,picksContinuousPolling:false,historicalSummaryCache:true,weeklyOutlookCache:true,heavyDiagnosticsDisabled:true,d1UsageGuardrails:true},response.status,response.headers);
  }
  if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/app')){
    if(!response.ok)return response;return new Response(withStabilityUi(replaceVersions(await response.text())),{status:response.status,headers:response.headers});
  }
  if(request.method==='GET'&&url.pathname==='/sw.js'){
    if(!response.ok)return response;return new Response(replaceVersions(await response.text()),{status:response.status,headers:response.headers});
  }
  return response;
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const s=await stabilityRoute(request,env,ctx,url);if(s)return s;
    const c=await cacheRoute(request,env,url);if(c)return c;
    const response=await app.fetch(request,env,ctx);
    if(env.DB&&invalidatesWeeklyOutlook(request,url,response)){try{await invalidateWeeklyOutlookCache(env.DB);}catch{}}
    return upgrade(request,response);
  },
  scheduled(controller,env,ctx){return app.scheduled(controller,env,ctx);}
};
