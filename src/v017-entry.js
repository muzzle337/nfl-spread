import app from "./v016-entry.js";
import { isAdminSessionAuthorized } from "./admin-session.js";
import { resolveDashboardWeek } from "./dashboard-data.js";
import { weeklyGameOutlooks, saveWeeklyPick, poolSeasonSummary } from "./weekly-picks.js";
import { withGameOutlookPicksUi } from "./game-outlook-picks-ui.js";
import { withPicksPolishUi } from "./picks-polish-ui.js";

export const APP_VERSION="0.17.0";
function json(body,status=200,headers={}){return new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers}})}
function replaceVersions(body){return String(body).split("0.12.0").join(APP_VERSION).split("0.13.0").join(APP_VERSION).split("0.13.1").join(APP_VERSION).split("0.13.2").join(APP_VERSION).split("0.13.3").join(APP_VERSION).split("0.14.0").join(APP_VERSION).split("0.15.0").join(APP_VERSION).split("0.16.0").join(APP_VERSION)}

async function target(env,url){
 const rawS=url.searchParams.get('season'),rawW=url.searchParams.get('week');
 const s=rawS===null?null:Number(rawS),w=rawW===null?null:Number(rawW);
 if(Number.isInteger(s)&&Number.isInteger(w))return {season:s,week:w};
 return resolveDashboardWeek(env.DB);
}

async function poolRoute(request,env,url){
 if(!url.pathname.startsWith('/api/pool/'))return null;
 if(!env.DB)return json({error:'Database is not bound'},503);
 if(url.pathname==='/api/pool/outlooks'&&request.method==='GET'){
  const t=await target(env,url);if(!Number.isInteger(t.season)||!Number.isInteger(t.week))return json({error:'No active NFL week is available'},400);
  try{const [games,summary]=await Promise.all([weeklyGameOutlooks(env.DB,t.season,t.week),poolSeasonSummary(env.DB,t.season)]);return json({ok:true,season:t.season,week:t.week,games,summary,principle:'Game Outlook explains agreement and conflict across market, current-season spread, history and context. It does not manufacture a new probability.',percentageLabel:'market_no_vig_win_probability'});}catch(error){return json({error:'Game Outlook unavailable',message:error.message},400)}
 }
 if(url.pathname==='/api/pool/picks'&&request.method==='POST'){
  const auth=await isAdminSessionAuthorized(request,env);if(!auth.ok)return json({error:auth.error},auth.status);
  const body=await request.json().catch(()=>({}));
  try{return json({ok:true,pick:await saveWeeklyPick(env.DB,body)});}catch(error){return json({error:'Unable to save weekly pick',message:error.message},400)}
 }
 return json({error:'Method not allowed'},405);
}

async function upgrade(request,response){
 const url=new URL(request.url);
 if(url.pathname==='/api/health'){
  const b=await response.json().catch(()=>null);if(!b||typeof b!=='object')return response;
  return json({...b,version:APP_VERSION,gameOutlook:true,weeklyPoolPicks:true,weeklyPoolGrading:true,imessageExport:true,publicPickPercentage:false,weeklyPoolPercentageBasis:'consensus no-vig market win probability',gameOutlookAffectsPredictions:false},response.status,response.headers);
 }
 if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/app')){
  if(!response.ok)return response;const body=withGameOutlookPicksUi(replaceVersions(await response.text()));return new Response(withPicksPolishUi(body),{status:response.status,headers:response.headers});
 }
 if(request.method==='GET'&&url.pathname==='/sw.js'){
  if(!response.ok)return response;return new Response(replaceVersions(await response.text()),{status:response.status,headers:response.headers});
 }
 return response;
}

export default{
 async fetch(request,env,ctx){const url=new URL(request.url);const p=await poolRoute(request,env,url);if(p)return p;return upgrade(request,await app.fetch(request,env,ctx));},
 scheduled(controller,env,ctx){return app.scheduled(controller,env,ctx);}
};
