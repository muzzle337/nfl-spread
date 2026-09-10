import app from './v020-entry.js';
import { dataFreshness } from './data-freshness.js';
import { withV021Ui } from './v021-ui.js';

export const APP_VERSION='0.21.0';
function json(body,status=200,headers={}){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}})}
function replaceVersions(body){return String(body).split('0.12.0').join(APP_VERSION).split('0.13.0').join(APP_VERSION).split('0.13.1').join(APP_VERSION).split('0.13.2').join(APP_VERSION).split('0.13.3').join(APP_VERSION).split('0.14.0').join(APP_VERSION).split('0.15.0').join(APP_VERSION).split('0.16.0').join(APP_VERSION).split('0.17.0').join(APP_VERSION).split('0.17.1').join(APP_VERSION).split('0.18.0').join(APP_VERSION).split('0.18.1').join(APP_VERSION).split('0.18.2').join(APP_VERSION).split('0.19.0').join(APP_VERSION).split('0.19.1').join(APP_VERSION).split('0.20.0').join(APP_VERSION).split('0.20.1').join(APP_VERSION)}

async function freshnessRoute(request,env,url){
 if(url.pathname!=='/api/data/freshness')return null;
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 if(!env.DB)return json({error:'Database is not bound'},503);
 try{
  const season=url.searchParams.get('season'),week=url.searchParams.get('week');
  return json({ok:true,...await dataFreshness(env.DB,{season,week,now:new Date()})});
 }catch(error){return json({error:'Freshness unavailable',message:error.message},400)}
}
async function upgrade(request,response){
 const url=new URL(request.url);
 if(url.pathname==='/api/health'){
  const b=await response.json().catch(()=>null);if(!b||typeof b!=='object')return response;
  return json({...b,version:APP_VERSION,canonicalGameDetail:true,dataFreshnessContract:true,staleDataVisible:true,toolsViewIsolated:true,normalUiRawHistoryReads:false},response.status,response.headers);
 }
 if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/app')){
  if(!response.ok)return response;return new Response(withV021Ui(replaceVersions(await response.text())),{status:response.status,headers:response.headers});
 }
 if(request.method==='GET'&&url.pathname==='/sw.js'){
  if(!response.ok)return response;return new Response(replaceVersions(await response.text()),{status:response.status,headers:response.headers});
 }
 return response;
}
export default{
 async fetch(request,env,ctx){const url=new URL(request.url);const f=await freshnessRoute(request,env,url);if(f)return f;return upgrade(request,await app.fetch(request,env,ctx));},
 scheduled(controller,env,ctx){return app.scheduled(controller,env,ctx);}
};
