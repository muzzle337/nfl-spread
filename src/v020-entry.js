import app from './v019-entry.js';
import { resolveDashboardWeek } from './dashboard-data.js';
import { weeklyGameOutlooks } from './weekly-picks.js';
import { rankOpportunities } from './opportunity-focus.js';
import { withOpportunityFocusUi } from './opportunity-focus-ui.js';

export const APP_VERSION='0.20.0';
function json(body,status=200,headers={}){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}})}
function replaceVersions(body){return String(body).split('0.12.0').join(APP_VERSION).split('0.13.0').join(APP_VERSION).split('0.13.1').join(APP_VERSION).split('0.13.2').join(APP_VERSION).split('0.13.3').join(APP_VERSION).split('0.14.0').join(APP_VERSION).split('0.15.0').join(APP_VERSION).split('0.16.0').join(APP_VERSION).split('0.17.0').join(APP_VERSION).split('0.17.1').join(APP_VERSION).split('0.18.0').join(APP_VERSION).split('0.18.1').join(APP_VERSION).split('0.18.2').join(APP_VERSION).split('0.19.0').join(APP_VERSION).split('0.19.1').join(APP_VERSION)}
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

async function upgrade(request,response){
  const url=new URL(request.url);
  if(url.pathname==='/api/health'){
    const b=await response.json().catch(()=>null);if(!b||typeof b!=='object')return response;
    return json({...b,version:APP_VERSION,opportunityEdgeFocus:true,focusAffectsPredictions:false,focusRawHistoryReads:false,focusBackgroundPolling:false},response.status,response.headers);
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
  async fetch(request,env,ctx){const url=new URL(request.url);const f=await focusRoute(request,env,url);if(f)return f;return upgrade(request,await app.fetch(request,env,ctx));},
  scheduled(controller,env,ctx){return app.scheduled(controller,env,ctx);}
};
