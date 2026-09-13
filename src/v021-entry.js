import app from './v020-entry.js';
import { dataFreshness } from './data-freshness.js';
import { withV021Ui } from './v021-ui.js';
import { withCanonicalGameDetail } from './canonical-game-detail.js';

export const APP_VERSION='0.21.6';
function json(body,status=200,headers={}){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}})}
function replaceVersions(body){return String(body).split('0.12.0').join(APP_VERSION).split('0.13.0').join(APP_VERSION).split('0.13.1').join(APP_VERSION).split('0.13.2').join(APP_VERSION).split('0.13.3').join(APP_VERSION).split('0.14.0').join(APP_VERSION).split('0.15.0').join(APP_VERSION).split('0.16.0').join(APP_VERSION).split('0.17.0').join(APP_VERSION).split('0.17.1').join(APP_VERSION).split('0.18.0').join(APP_VERSION).split('0.18.1').join(APP_VERSION).split('0.18.2').join(APP_VERSION).split('0.19.0').join(APP_VERSION).split('0.19.1').join(APP_VERSION).split('0.20.0').join(APP_VERSION).split('0.20.1').join(APP_VERSION).split('0.21.0').join(APP_VERSION).split('0.21.1').join(APP_VERSION).split('0.21.2').join(APP_VERSION).split('0.21.3').join(APP_VERSION).split('0.21.4').join(APP_VERSION).split('0.21.5').join(APP_VERSION)}

function hardenLegacyRuntime(body){
 const cardCss=`<style>
[data-cg19-board]{display:none!important}.kickoff{font-weight:700}.game-card .kickoff{font-size:11px;line-height:1.25;color:#8c9aaa;font-weight:750;letter-spacing:.02em;margin:8px 0 10px}.detail .kickoff{font-size:15px;color:#f4f7fb;font-weight:900}.tier-signal{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin-top:10px;padding:10px 11px;border:1px solid rgba(76,166,255,.24);background:rgba(76,166,255,.07);border-radius:10px}.tier-signal-label{color:#8c9aaa;font-size:9px;font-weight:850;letter-spacing:.055em}.tier-signal-value{color:#4ca6ff;font-size:14px;font-weight:950;text-align:center}.tier-signal-meta{color:#aeb9c4;font-size:10px;font-weight:800;white-space:nowrap}.game-card .at.df21-game-status{min-width:64px;text-align:center;font-size:9px;line-height:1.1;letter-spacing:.075em;font-weight:950;color:#8c9aaa}.game-card .at.df21-game-status.final{color:#f4f7fb}.game-card .at.df21-game-status.live{color:#72dc66}.game-card .team>div{min-width:0;display:flex;flex-direction:column}.game-card .team-code{order:1}.game-card .team-name{order:2}.game-card .team-market{order:3}.df21-team-score{order:4;margin-top:7px;font-size:28px;line-height:1;font-weight:950;color:#f4f7fb;letter-spacing:-.035em}.team.home .df21-team-score{text-align:right}.df21-team-score.loser{color:#98a5b3}.game-card.df21-final .kickoff,.game-card.df21-live .kickoff{display:none!important}.game-card.df21-final .game-top,.game-card.df21-live .game-top{padding:3px 0 10px}.game-card.df21-final .team-code,.game-card.df21-live .team-code{font-size:15px}.game-card.df21-final .team-name,.game-card.df21-live .team-name{margin-bottom:1px}.game-card.df21-final .tier-signal{border-color:rgba(114,220,102,.22);background:rgba(114,220,102,.06)}.game-card.df21-final .tier-signal-value{color:#f4f7fb}
</style>`;
 return String(body)
  .split("setInterval(function(){if(!S.picksMode)load()},120000);").join("/* recurring pool polling disabled by core recovery */")
  .split("var status = game.projectionStatus === 'READY' ? (esc(game.projectedTeam) + ' · ' + esc(game.projectedCoverRate) + '%') : 'No 2026 projection yet';")
  .join("var status = game.final ? '' : (game.projectionStatus === 'READY' ? (esc(game.projectedTeam) + ' · ' + esc(game.projectedCoverRate) + '%') : 'No 2026 projection yet'); var isFinal=!!game.final; var isLive=!!game.live; var scoreState=game.final||game.live||null; var post=game.postgame||null; var bucket=post&&post.liveBucket||null; var tierSignalLabel=isFinal?'FINAL SPREAD RESULT':'LIVE TIER EDGE'; var tierSignal=isFinal?(post?(post.spreadResult==='PUSH'?'PUSH':(esc(teamInfo(post.coveringTeam).code)+' COVERED')):'FINAL'):(game.projectionStatus==='READY'?(esc(game.projectedTeam)+' · '+esc(game.projectedCoverRate)+'%'):'No tier edge yet'); var tierMeta=isFinal?(bucket?((post&&post.classification?esc(classLabel(post.classification))+' · ':'')+esc(tierLabel(post&&post.tier))+' · '+esc(bucket.wins)+'-'+esc(bucket.losses)+(bucket.pushes?('-'+esc(bucket.pushes)):'')+(bucket.coverRate!==null?(' · '+esc(bucket.coverRate)+'%'):' · —')):'Final stats unavailable'):('n='+esc(game.sampleSize||0)+(game.grade?(' · Grade '+esc(game.grade)):''));")
  .split("'<div class=\"team\"><img class=\"team-logo\" alt=\"\" src=\"' + logo(game.awayTeam) + '\"><div><div class=\"team-code\">' + esc(away.code) + '</div><div class=\"team-name\">' + esc(shortTeam(game.awayTeam)) + '</div></div></div>' +")
  .join("'<div class=\"team\"><img class=\"team-logo\" alt=\"\" src=\"' + logo(game.awayTeam) + '\"><div><div class=\"team-code\">' + esc(away.code) + '</div><div class=\"team-name\">' + esc(shortTeam(game.awayTeam)) + '</div>' + (scoreState?('<div class=\"df21-team-score'+(game.final&&Number(scoreState.awayScore)<Number(scoreState.homeScore)?' loser':'')+'\">'+esc(scoreState.awayScore)+'</div>'):'') + '</div></div>' +")
  .split("'<div class=\"at\">@</div>' +")
  .join("'<div class=\"at df21-game-status ' + (game.final?'final':(game.live?'live':'')) + '\">' + (game.final?'FINAL':(game.live?'LIVE':'UPCOMING')) + '</div>' +")
  .split("'<div class=\"team home\"><div><div class=\"team-code\">' + esc(home.code) + '</div><div class=\"team-name\">' + esc(shortTeam(game.homeTeam)) + '</div></div><img class=\"team-logo\" alt=\"\" src=\"' + logo(game.homeTeam) + '\"></div>' +")
  .join("'<div class=\"team home\"><div><div class=\"team-code\">' + esc(home.code) + '</div><div class=\"team-name\">' + esc(shortTeam(game.homeTeam)) + '</div>' + (scoreState?('<div class=\"df21-team-score'+(game.final&&Number(scoreState.homeScore)<Number(scoreState.awayScore)?' loser':'')+'\">'+esc(scoreState.homeScore)+'</div>'):'') + '</div><img class=\"team-logo\" alt=\"\" src=\"' + logo(game.homeTeam) + '\"></div>' +")
  .split("'<div class=\"kickoff\">' + esc(kickoffLabel(game.kickoffAt)) + '</div>' +")
  .join("'<div class=\"kickoff\">' + ((game.final||game.live)?'':esc(kickoffLabel(game.kickoffAt))) + '</div>' +")
  .split("'<div class=\"game-footer\"><span class=\"market-range\">Range ' + esc(rangeLabel(game)) + ' · ' + esc(game.bookmakerCount) + ' books · ' + status + '</span>' + gradeChip(game.grade) + '</div>' +")
  .join("'<div class=\"tier-signal\"><span class=\"tier-signal-label\">' + tierSignalLabel + '</span><strong class=\"tier-signal-value\">' + tierSignal + '</strong><span class=\"tier-signal-meta\">' + tierMeta + '</span></div>' + '<div class=\"game-footer\"><span class=\"market-range\">Range ' + esc(rangeLabel(game)) + ' · ' + esc(game.bookmakerCount) + ' books' + (status ? (' · ' + status) : '') + '</span>' + gradeChip(game.grade) + '</div>' +")
  .split("'<button class=\"game-card\" data-game=\"' + esc(game.id) + '\">' +")
  .join("'<button class=\"game-card ' + (game.final?'df21-final':(game.live?'df21-live':'')) + '\" data-game=\"' + esc(game.id) + '\">' +")
  .replace('</head>',cardCss+'</head>');
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
  return json({...b,version:APP_VERSION,canonicalGameDetail:true,canonicalGameDetailRendered:true,gameDetailVisualGate:true,dataFreshnessContract:true,staleDataVisible:true,toolsViewIsolated:true,normalUiRawHistoryReads:false,legacyRecurringPolling:false,legacyHistoricalBoardSuppressed:true,coreRecovery:true,staleFinalRecovery:'nflverse',finalScoresVisible:true,finalScoreProminent:true,liveInWeekTiers:true,tierPercentVisibleOnCards:true,gameCardStatusFirst:true,teamScoresInline:true,finalCardsPostgameOnly:true,finalCardPostgameStats:true,productionDomVerified:true},response.status,response.headers);
 }
 if(request.method==='GET'&&(url.pathname==='/'||url.pathname==='/app')){
  if(!response.ok)return response;
  const body=hardenLegacyRuntime(replaceVersions(await response.text()));
  return new Response(withCanonicalGameDetail(withV021Ui(body)),{status:response.status,headers:response.headers});
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
