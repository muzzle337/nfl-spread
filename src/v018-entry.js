import app from "./v017-entry.js";
import { withStabilityUi } from "./stability-ui.js";

export const APP_VERSION="0.18.1";
function json(body,status=200,headers={}){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}})}
function replaceVersions(body){return String(body).split("0.12.0").join(APP_VERSION).split("0.13.0").join(APP_VERSION).split("0.13.1").join(APP_VERSION).split("0.13.2").join(APP_VERSION).split("0.13.3").join(APP_VERSION).split("0.14.0").join(APP_VERSION).split("0.15.0").join(APP_VERSION).split("0.16.0").join(APP_VERSION).split("0.17.0").join(APP_VERSION).split("0.17.1").join(APP_VERSION).split("0.18.0").join(APP_VERSION)}

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
  const paths=['/api/health','/api/dashboard/nfl','/api/context/opportunities','/api/history/matchups','/api/pool/outlooks'];
  const checks=[];for(const path of paths)checks.push(await inspect(request,env,ctx,path));
  return json({ok:checks.every(x=>x.ok&&x.validJson),version:APP_VERSION,checks,principle:'A supporting subsystem may fail without taking down the rest of the app.'});
}

async function upgrade(request,response){
  const url=new URL(request.url);
  if(url.pathname==='/api/health'){
    const body=await response.json().catch(()=>null);if(!body||typeof body!=='object')return response;
    return json({...body,version:APP_VERSION,stabilityAudit:true,viewIsolation:true,uiDedupeGuard:true,contractDiagnostics:true,browserRegressionGate:true,d1ReadHotfix:true,picksContinuousPolling:false},response.status,response.headers);
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
  async fetch(request,env,ctx){const url=new URL(request.url);const s=await stabilityRoute(request,env,ctx,url);if(s)return s;return upgrade(request,await app.fetch(request,env,ctx));},
  scheduled(controller,env,ctx){return app.scheduled(controller,env,ctx);}
};
