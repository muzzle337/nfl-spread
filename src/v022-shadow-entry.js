import app from './v021-entry.js';
import { resolveDashboardWeek } from './dashboard-data.js';
import { weeklyGameOutlooks } from './weekly-picks.js';
import { dataFreshness } from './data-freshness.js';
import { buildCanonicalWeeklyPayload, compareWeeklyParity } from './weekly-intelligence.js';

export const APP_VERSION='0.22.0-shadow';
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}

async function target(db,url){
  const s=Number(url.searchParams.get('season')),w=Number(url.searchParams.get('week'));
  if(Number.isInteger(s)&&Number.isInteger(w)&&w>0)return{season:s,week:w};
  return resolveDashboardWeek(db);
}

/**
 * Shadow-only route. It deliberately reuses the current v0.21 engine so we can
 * prove output parity before replacing any production route or UI loader.
 * wrangler.jsonc MUST NOT point to this entry during the shadow phase.
 */
async function shadowWeek(request,env,url){
  if(url.pathname!=='/api/shadow/week')return null;
  if(request.method!=='GET')return json({error:'Method not allowed'},405);
  if(!env.DB)return json({error:'Database is not bound'},503);
  try{
    const t=await target(env.DB,url);
    const legacyGames=await weeklyGameOutlooks(env.DB,t.season,t.week);
    const freshness=await dataFreshness(env.DB,{season:t.season,week:t.week,now:new Date()});
    const payload=buildCanonicalWeeklyPayload({season:t.season,week:t.week,games:legacyGames,freshness});
    const parity=compareWeeklyParity(payload,legacyGames);
    return json({ok:parity.ok,shadow:true,productionChanged:false,season:t.season,week:t.week,parity,payload});
  }catch(error){return json({error:'Shadow weekly payload unavailable',message:error.message},400)}
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    const shadow=await shadowWeek(request,env,url);if(shadow)return shadow;
    return app.fetch(request,env,ctx);
  },
  scheduled(controller,env,ctx){return app.scheduled(controller,env,ctx);}
};
