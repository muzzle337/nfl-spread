import app from "./v018-entry.js";
import { withCompleteGameDetailUi } from "./complete-game-detail-ui.js";
import { withV019PolishUi } from "./v019-polish-ui.js";

export const APP_VERSION="0.19.0";
function json(body,status=200,headers={}){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}})}
function replaceVersions(body){return String(body).split("0.12.0").join(APP_VERSION).split("0.13.0").join(APP_VERSION).split("0.13.1").join(APP_VERSION).split("0.13.2").join(APP_VERSION).split("0.13.3").join(APP_VERSION).split("0.14.0").join(APP_VERSION).split("0.15.0").join(APP_VERSION).split("0.16.0").join(APP_VERSION).split("0.17.0").join(APP_VERSION).split("0.17.1").join(APP_VERSION).split("0.18.0").join(APP_VERSION).split("0.18.1").join(APP_VERSION).split("0.18.2").join(APP_VERSION)}

async function upgrade(request,response){
 const url=new URL(request.url);
 if(url.pathname==='/api/health'){
  const body=await response.json().catch(()=>null);if(!body||typeof body!=='object')return response;
  return json({...body,version:APP_VERSION,allGameHistoricalIndicators:true,completeGameDetail:true,nonNotableHistoryVisible:true,completeGameDetailAffectsPredictions:false},response.status,response.headers);
 }
 if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/app')){
  if(!response.ok)return response;const body=withCompleteGameDetailUi(replaceVersions(await response.text()));return new Response(withV019PolishUi(body),{status:response.status,headers:response.headers});
 }
 if(request.method==='GET'&&url.pathname==='/sw.js'){
  if(!response.ok)return response;return new Response(replaceVersions(await response.text()),{status:response.status,headers:response.headers});
 }
 return response;
}

export default{
 async fetch(request,env,ctx){return upgrade(request,await app.fetch(request,env,ctx));},
 scheduled(controller,env,ctx){return app.scheduled(controller,env,ctx);}
};
