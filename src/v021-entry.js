import app from './v020-entry.js';
import { dataFreshness } from './data-freshness.js';
import { withV021Ui } from './v021-ui.js';

export const APP_VERSION='0.21.3';
function json(body,status=200,headers={}){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}})}
function replaceVersions(body){return String(body).split('0.12.0').join(APP_VERSION).split('0.13.0').join(APP_VERSION).split('0.13.1').join(APP_VERSION).split('0.13.2').join(APP_VERSION).split('0.13.3').join(APP_VERSION).split('0.14.0').join(APP_VERSION).split('0.15.0').join(APP_VERSION).split('0.16.0').join(APP_VERSION).split('0.17.0').join(APP_VERSION).split('0.17.1').join(APP_VERSION).split('0.18.0').join(APP_VERSION).split('0.18.1').join(APP_VERSION).split('0.18.2').join(APP_VERSION).split('0.19.0').join(APP_VERSION).split('0.19.1').join(APP_VERSION).split('0.20.0').join(APP_VERSION).split('0.20.1').join(APP_VERSION).split('0.21.0').join(APP_VERSION).split('0.21.1').join(APP_VERSION).split('0.21.2').join(APP_VERSION)}

function hardenLegacyRuntime(body){
 return String(body)
  .split("setInterval(function(){if(!S.picksMode)load()},120000);").join("/* recurring pool polling disabled by core recovery */")
  .split("var status = game.projectionStatus === 'READY' ? (esc(game.projectedTeam) + ' · ' + esc(game.projectedCoverRate) + '%') : 'No 2026 projection yet';")
  .join("var status = game.final ? '' : (game.projectionStatus === 'READY' ? (esc(game.projectedTeam) + ' · ' + esc(game.projectedCoverRate) + '%') : 'No 2026 projection yet'); var tierSignalLabel = game.final ? 'PREGAME TIER EDGE' : 'LIVE TIER EDGE'; var tierSignal = game.projectionStatus === 'READY' ? (esc(game.projectedTeam) + ' · ' + esc(game.projectedCoverRate) + '%') : 'No tier edge yet'; var tierMeta = 'n=' + esc(game.sampleSize || 0) + (game.grade ? (' · Grade ' + esc(game.grade)) : '');")
  .split("'<div class=\"kickoff\">' + esc(kickoffLabel(game.kickoffAt)) + '</div>' +")
  .join("'<div class=\"kickoff\">' + (game.final ? ('FINAL · ' + esc(away.code) + ' ' + esc(game.final.awayScore) + ' — ' + esc(home.code) + ' ' + esc(game.final.homeScore)) : esc(kickoffLabel(game.kickoffAt))) + '</div>' +")
  .split("'<div class=\"game-footer\"><span class=\"market-range\">Range ' + esc(rangeLabel(game)) + ' · ' + esc(game.bookmakerCount) + ' books · ' + status + '</span>' + gradeChip(game.grade) + '</div>' +")
  .join("'<div class=\"tier-signal\"><span class=\"tier-signal-label\">' + tierSignalLabel + '</span><strong class=\"tier-signal-value\">' + tierSignal + '</strong><span class=\"tier-signal-meta\">' + tierMeta + '</span></div>' + '<div class=\"game-footer\"><span class=\"market-range\">Range ' + esc(rangeLabel(game)) + ' · ' + esc(game.bookmakerCount) + ' books' + (status ? (' · ' + status) : '') + '</span>' + gradeChip(game.grade) + '</div>' +")
  .replace('</head>','<style>[data-cg19-board]{display:none!important}.kickoff{font-weight:700}.game-card .kickoff{font-size:16px;line-height:1.25;color:#f4f7fb;font-weight:900;letter-spacing:.02em;margin:11px 0 12px}.detail .kickoff{font-size:15px;color:#f4f7fb;font-weight:900}.tier-signal{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin-top:10px;padding:10px 11px;border:1px solid rgba(76,166,255,.24);background:rgba(76,166,255,.07);border-radius:10px}.tier-signal-label{color:#8c9aaa;font-size:9px;font-weight:850;letter-spacing:.055em}.tier-signal-value{color:#4ca6ff;font-size:14px;font-weight:950;text-align:center}.tier-signal-meta{color:#aeb9c4;font-size:10px;font-weight:800;white-space:nowrap}</style></head>');
}

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
  return json({...b,version:APP_VERSION,canonicalGameDetail:true,dataFreshnessContract:true,staleDataVisible:true,toolsViewIsolated:true,normalUiRawHistoryReads:false,legacyRecurringPolling:false,legacyHistoricalBoardSuppressed:true,coreRecovery:true,staleFinalRecovery:'nflverse',finalScoresVisible:true,finalScoreProminent:true,liveInWeekTiers:true,tierPercentVisibleOnCards:true},response.status,response.headers);
 }
 if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/app')){
  if(!response.ok)return response;
  const body=hardenLegacyRuntime(replaceVersions(await response.text()));
  return new Response(withV021Ui(body),{status:response.status,headers:response.headers});
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
