import app from './v020-entry.js';
import { dataFreshness } from './data-freshness.js';
import { withV021Ui } from './v021-ui.js';

export const APP_VERSION='0.21.4';
function json(body,status=200,headers={}){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}})}
function replaceVersions(body){return String(body).split('0.12.0').join(APP_VERSION).split('0.13.0').join(APP_VERSION).split('0.13.1').join(APP_VERSION).split('0.13.2').join(APP_VERSION).split('0.13.3').join(APP_VERSION).split('0.14.0').join(APP_VERSION).split('0.15.0').join(APP_VERSION).split('0.16.0').join(APP_VERSION).split('0.17.0').join(APP_VERSION).split('0.17.1').join(APP_VERSION).split('0.18.0').join(APP_VERSION).split('0.18.1').join(APP_VERSION).split('0.18.2').join(APP_VERSION).split('0.19.0').join(APP_VERSION).split('0.19.1').join(APP_VERSION).split('0.20.0').join(APP_VERSION).split('0.20.1').join(APP_VERSION).split('0.21.0').join(APP_VERSION).split('0.21.1').join(APP_VERSION).split('0.21.2').join(APP_VERSION).split('0.21.3').join(APP_VERSION)}

function hardenLegacyRuntime(body){
 const cardPolish=`<style>
[data-cg19-board]{display:none!important}.kickoff{font-weight:700}.game-card .kickoff{font-size:16px;line-height:1.25;color:#f4f7fb;font-weight:900;letter-spacing:.02em;margin:11px 0 12px}.detail .kickoff{font-size:15px;color:#f4f7fb;font-weight:900}.tier-signal{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin-top:10px;padding:10px 11px;border:1px solid rgba(76,166,255,.24);background:rgba(76,166,255,.07);border-radius:10px}.tier-signal-label{color:#8c9aaa;font-size:9px;font-weight:850;letter-spacing:.055em}.tier-signal-value{color:#4ca6ff;font-size:14px;font-weight:950;text-align:center}.tier-signal-meta{color:#aeb9c4;font-size:10px;font-weight:800;white-space:nowrap}.game-card .at.df21-game-status{min-width:58px;text-align:center;font-size:9px;line-height:1.1;letter-spacing:.075em;font-weight:950;color:#8c9aaa}.game-card .at.df21-game-status.final{color:#f4f7fb}.game-card .team>div{min-width:0}.df21-team-score{margin-top:5px;font-size:25px;line-height:1;font-weight:950;color:#f4f7fb;letter-spacing:-.035em}.team.home .df21-team-score{text-align:right}.df21-team-score.loser{color:#98a5b3}.game-card.df21-final .kickoff{display:none!important}.game-card.df21-final .game-top{padding:2px 0 10px}.game-card.df21-final .team-code{font-size:15px}.game-card.df21-final .team-name{margin-bottom:1px}
</style><script>(function(){function polish(){document.querySelectorAll('.game-card').forEach(function(card){var center=card.querySelector('.at');if(!center)return;var kickoff=card.querySelector('.kickoff');var text=(kickoff&&kickoff.textContent||'').trim();var m=text.match(/^FINAL\s*·\s*([A-Z]{2,3})\s+(\d+)\s*[—-]\s*([A-Z]{2,3})\s+(\d+)$/);card.querySelectorAll('.df21-team-score').forEach(function(x){x.remove()});center.classList.add('df21-game-status');if(m){card.classList.add('df21-final');center.textContent='FINAL';center.classList.add('final');var teams=card.querySelectorAll('.team');var a=Number(m[2]),h=Number(m[4]);if(teams[0]){var inner=teams[0].querySelector('div');if(inner){var s=document.createElement('div');s.className='df21-team-score'+(a<h?' loser':'');s.textContent=m[2];inner.appendChild(s)}}if(teams[1]){var inner2=teams[1].querySelector('div');if(inner2){var s2=document.createElement('div');s2.className='df21-team-score'+(h<a?' loser':'');s2.textContent=m[4];inner2.appendChild(s2)}}}else{card.classList.remove('df21-final');center.classList.remove('final');center.textContent='UPCOMING'}})}document.addEventListener('click',function(ev){if(ev.target.closest&&ev.target.closest('[data-tab],.nav-btn,[data-filter]'))setTimeout(polish,80)},true);document.addEventListener('DOMContentLoaded',function(){var n=0,t=setInterval(function(){polish();n++;if(n>20)clearInterval(t)},250)});})();</script>`;
 return String(body)
  .split("setInterval(function(){if(!S.picksMode)load()},120000);").join("/* recurring pool polling disabled by core recovery */")
  .split("var status = game.projectionStatus === 'READY' ? (esc(game.projectedTeam) + ' · ' + esc(game.projectedCoverRate) + '%') : 'No 2026 projection yet';")
  .join("var status = game.final ? '' : (game.projectionStatus === 'READY' ? (esc(game.projectedTeam) + ' · ' + esc(game.projectedCoverRate) + '%') : 'No 2026 projection yet'); var tierSignalLabel = game.final ? 'PREGAME TIER EDGE' : 'LIVE TIER EDGE'; var tierSignal = game.projectionStatus === 'READY' ? (esc(game.projectedTeam) + ' · ' + esc(game.projectedCoverRate) + '%') : 'No tier edge yet'; var tierMeta = 'n=' + esc(game.sampleSize || 0) + (game.grade ? (' · Grade ' + esc(game.grade)) : '');")
  .split("'<div class=\"kickoff\">' + esc(kickoffLabel(game.kickoffAt)) + '</div>' +")
  .join("'<div class=\"kickoff\">' + (game.final ? ('FINAL · ' + esc(away.code) + ' ' + esc(game.final.awayScore) + ' — ' + esc(home.code) + ' ' + esc(game.final.homeScore)) : esc(kickoffLabel(game.kickoffAt))) + '</div>' +")
  .split("'<div class=\"game-footer\"><span class=\"market-range\">Range ' + esc(rangeLabel(game)) + ' · ' + esc(game.bookmakerCount) + ' books · ' + status + '</span>' + gradeChip(game.grade) + '</div>' +")
  .join("'<div class=\"tier-signal\"><span class=\"tier-signal-label\">' + tierSignalLabel + '</span><strong class=\"tier-signal-value\">' + tierSignal + '</strong><span class=\"tier-signal-meta\">' + tierMeta + '</span></div>' + '<div class=\"game-footer\"><span class=\"market-range\">Range ' + esc(rangeLabel(game)) + ' · ' + esc(game.bookmakerCount) + ' books' + (status ? (' · ' + status) : '') + '</span>' + gradeChip(game.grade) + '</div>' +")
  .replace('</head>',cardPolish+'</head>');
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
  return json({...b,version:APP_VERSION,canonicalGameDetail:true,dataFreshnessContract:true,staleDataVisible:true,toolsViewIsolated:true,normalUiRawHistoryReads:false,legacyRecurringPolling:false,legacyHistoricalBoardSuppressed:true,coreRecovery:true,staleFinalRecovery:'nflverse',finalScoresVisible:true,finalScoreProminent:true,liveInWeekTiers:true,tierPercentVisibleOnCards:true,gameCardStatusFirst:true,teamScoresInline:true},response.status,response.headers);
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
