export function withContextUi(html) {
  if (typeof html !== "string") return html;
  const extension = `
<style>
  .ctx-mini{margin-top:9px;padding-top:9px;border-top:1px solid rgba(255,255,255,.06)}
  .ctx-mini-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}.ctx-mini-title{font-size:8px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;color:#718091}.ctx-mini-note{font-size:8px;color:#5f6d7a}
  .ctx-observation{display:flex;align-items:flex-start;gap:6px;font-size:9px;line-height:1.35;color:#a4b0bc;margin-top:4px}.ctx-dot{width:6px;height:6px;border-radius:50%;margin-top:3px;flex:0 0 auto;background:#718091}.ctx-observation.warning .ctx-dot{background:#f1c84b}.ctx-observation.supporting .ctx-dot{background:#72dc66}.ctx-observation.interesting .ctx-dot{background:#4ca6ff}
  .ctx-detail-source{font-size:9px;color:#6f7e8d;line-height:1.45;margin-top:10px}.ctx-venue{font-size:12px;font-weight:850;margin-bottom:5px}.ctx-sub{color:#8c9aaa;font-size:10px;line-height:1.45}
  .ctx-compare{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.ctx-side{border:1px solid rgba(255,255,255,.06);background:#121a24;border-radius:10px;padding:9px}.ctx-side strong{font-size:12px}.ctx-row{display:flex;justify-content:space-between;gap:8px;font-size:9px;color:#8c9aaa;margin-top:5px}.ctx-row b{color:#d9e3ec;font-weight:850;text-align:right;max-width:62%;overflow-wrap:anywhere}
  .ctx-weather{margin-top:9px;border:1px solid rgba(255,255,255,.06);background:#0b1118;border-radius:10px;padding:9px}.ctx-weather-title{font-size:10px;font-weight:850;margin-bottom:6px}.ctx-weather-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 10px}.ctx-weather-item{font-size:9px;color:#8c9aaa}.ctx-weather-item b{color:#d9e3ec;float:right}
  .ctx-quality{margin-top:10px;border:1px solid rgba(255,255,255,.06);background:#0b1118;border-radius:10px;padding:9px}.ctx-quality-head{display:flex;justify-content:space-between;gap:8px;font-size:10px;font-weight:850}.ctx-quality-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 10px;margin-top:7px}.ctx-check{font-size:9px;color:#8c9aaa}.ctx-check.ok{color:#9bdc91}.ctx-check.miss{color:#d7a7a7}
  .ctx-source-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}.ctx-source{border:1px solid rgba(255,255,255,.06);background:#121a24;border-radius:9px;padding:8px;font-size:9px}.ctx-source strong{display:block;margin-bottom:3px}.ctx-source.ok{color:#9bdc91}.ctx-source.bad{color:#ff9b9b}.ctx-source.warn{color:#f1c84b}.ctx-source small{color:#7f8d9c;display:block;line-height:1.35;margin-top:3px}
  .ctx-error{border:1px solid rgba(255,126,126,.28);background:rgba(255,126,126,.08);border-radius:10px;padding:10px;color:#ff9b9b;font-size:10px;line-height:1.45}.ctx-loading{border:1px solid rgba(76,166,255,.25);background:rgba(76,166,255,.07);border-radius:10px;padding:10px;color:#8ec8ff;font-size:10px}.ctx-sync-status{display:block;margin-top:3px;color:#718091;font-size:9px;font-weight:800}
  @media(max-width:420px){.ctx-source-grid{grid-template-columns:1fr}.ctx-quality-grid,.ctx-weather-grid{grid-template-columns:1fr}.ctx-compare{grid-template-columns:1fr}}
</style>
<script>
(function(){
  var ctxData=null,ctxKey='',loading=false,ctxError=null;
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
  function finite(v){var n=Number(v);return v!==null&&v!==undefined&&v!==''&&Number.isFinite(n)?n:null}
  function num(v,digits){var n=finite(v);if(n===null)return '—';var p=Math.pow(10,digits==null?2:digits);return String(Math.round(n*p)/p)}
  function signed(v){var n=finite(v);return n===null?'—':(n>0?'+':'')+num(n,1)}
  function pct(v){var n=finite(v);if(n===null)return '—';if(Math.abs(n)<=1)n*=100;return num(n,1)+'%'}
  function rec(m){if(!m)return '—';var w=finite(m.wins)||0,l=finite(m.losses)||0,t=finite(m.ties)||0;return w+'-'+l+(t?'-'+t:'')}
  function findGame(away,home){return ctxData&&ctxData.games&&ctxData.games.find(function(g){return g.awayCode===away&&g.homeCode===home})}
  function obsHtml(o){return '<div class="ctx-observation '+esc(o.kind)+'"><span class="ctx-dot"></span><span><strong>'+esc(o.label)+':</strong> '+esc(o.detail)+'</span></div>'}
  function sourceClass(status){return status==='matched'?'ok':status==='failed'?'bad':'warn'}
  function sourceLabel(status){return status==='matched'?'✅ matched':status==='failed'?'❌ failed':status==='not-imported'?'○ not imported':'⚠ unmatched'}
  function detailCodes(){
    var title=document.querySelector('.detail-title');
    var text=title&&title.textContent?title.textContent.trim():'';
    var parts=text.split('@');
    if(parts.length===2){var away=parts[0].trim(),home=parts[1].trim();if(away&&home)return [away,home]}
    var heroes=[].map.call(document.querySelectorAll('.detail .hero-code'),function(n){return n.textContent.trim()});
    return heroes.length>=2?[heroes[0],heroes[1]]:null;
  }
  function weatherHtml(w){
    if(!w)return '<div class="ctx-weather"><div class="ctx-weather-title">Kickoff Weather</div><div class="ctx-sub">No Open-Meteo forecast is stored for this game.</div></div>';
    var rows=[
      ['Temperature',finite(w.temperatureF)!==null?Math.round(w.temperatureF)+'°F':'—'],['Feels like',finite(w.apparentTemperatureF)!==null?Math.round(w.apparentTemperatureF)+'°F':'—'],
      ['Wind',finite(w.windMph)!==null?num(w.windMph,1)+' mph':'—'],['Gusts',finite(w.gustMph)!==null?num(w.gustMph,1)+' mph':'—'],
      ['Precip chance',finite(w.precipitationProbability)!==null?Math.round(w.precipitationProbability)+'%':'—'],['Precip amount',finite(w.precipitationIn)!==null?num(w.precipitationIn,2)+' in':'—'],
      ['Snowfall',finite(w.snowfallIn)!==null?num(w.snowfallIn,2)+' in':'—'],['Weather code',finite(w.weatherCode)!==null?num(w.weatherCode,0):'—']
    ];
    return '<div class="ctx-weather"><div class="ctx-weather-title">Kickoff Weather</div><div class="ctx-weather-grid">'+rows.map(function(r){return '<div class="ctx-weather-item">'+esc(r[0])+' <b>'+esc(r[1])+'</b></div>'}).join('')+'</div><div class="ctx-detail-source">Forecast hour: '+esc(w.forecastFor||'—')+' · fetched '+esc(w.fetchedAt||'—')+'</div></div>'
  }
  function teamHtml(code,m,rest,coach,qb){
    return '<div class="ctx-side"><strong>'+esc(code)+'</strong>'+
      '<div class="ctx-row"><span>Record</span><b>'+esc(rec(m))+'</b></div>'+
      '<div class="ctx-row"><span>Points for</span><b>'+esc(m&&m.pointsFor!=null?num(m.pointsFor,0):'—')+'</b></div>'+
      '<div class="ctx-row"><span>Points against</span><b>'+esc(m&&m.pointsAgainst!=null?num(m.pointsAgainst,0):'—')+'</b></div>'+
      '<div class="ctx-row"><span>Point diff</span><b>'+esc(m&&m.pointDiff!=null?signed(m.pointDiff):'—')+'</b></div>'+
      '<div class="ctx-row"><span>Off EPA</span><b>'+esc(m&&m.offensiveEpa!=null?num(m.offensiveEpa,3):'—')+'</b></div>'+
      '<div class="ctx-row"><span>Def EPA</span><b>'+esc(m&&m.defensiveEpa!=null?num(m.defensiveEpa,3):'—')+'</b></div>'+
      '<div class="ctx-row"><span>Success rate</span><b>'+esc(m&&m.successRate!=null?pct(m.successRate):'—')+'</b></div>'+
      '<div class="ctx-row"><span>Rest</span><b>'+esc(rest==null?'—':rest+'d')+'</b></div>'+
      '<div class="ctx-row"><span>Coach</span><b>'+esc(coach||'—')+'</b></div>'+
      '<div class="ctx-row"><span>QB</span><b>'+esc(qb||'—')+'</b></div>'+
      '<div class="ctx-detail-source">Metrics: '+esc(m&&m.source?m.source:'—')+' · '+esc(m&&m.syncedAt?m.syncedAt:'not synced')+'</div></div>'
  }
  function dataQuality(g){var q=g.quality||{loaded:0,total:0,checks:[]};return '<div class="ctx-quality"><div class="ctx-quality-head"><span>Data Quality</span><span>'+esc(q.loaded)+'/'+esc(q.total)+' fields loaded</span></div><div class="ctx-quality-grid">'+(q.checks||[]).map(function(c){return '<div class="ctx-check '+(c.ok?'ok':'miss')+'">'+(c.ok?'✅ ':'❌ ')+esc(c.label)+' <span style="color:#657382">· '+esc(c.source)+'</span></div>'}).join('')+'</div></div>'}
  function detailHtml(g){
    var w=g.weather||null,a=g.awayMetrics,h=g.homeMetrics;
    var venue=[g.stadium,g.location,g.roof,g.surface].filter(Boolean).join(' · ')||'Venue details not loaded';
    return '<section class="detail-card ctx-detail" data-context-panel="loaded"><h3>Context Intelligence</h3><div class="ctx-venue">'+esc(venue)+'</div><div class="ctx-sub">Context is informational only and never changes the spread or Survivor probability.</div>'+
      '<div class="ctx-source-grid"><div class="ctx-source '+sourceClass(g.sourceStatus&&g.sourceStatus.nflverse)+'"><strong>nflverse</strong>'+sourceLabel(g.sourceStatus&&g.sourceStatus.nflverse)+'<small>venue · surface · roof · rest · coach · QB</small></div><div class="ctx-source '+sourceClass(g.sourceStatus&&g.sourceStatus.nfldata)+'"><strong>nfldata</strong>'+sourceLabel(g.sourceStatus&&g.sourceStatus.nfldata)+'<small>game context · team metrics</small></div><div class="ctx-source '+(w&&w.fetchedAt?'ok':'warn')+'"><strong>Open-Meteo</strong>'+(w&&w.fetchedAt?'✅ loaded':'⚠ unavailable')+'<small>kickoff weather'+(w&&w.fetchedAt?' · '+esc(w.fetchedAt):'')+'</small></div></div>'+
      weatherHtml(w)+(g.observations||[]).map(obsHtml).join('')+'<div class="ctx-compare">'+teamHtml(g.awayCode,a,g.awayRest,g.awayCoach,g.awayQb)+teamHtml(g.homeCode,h,g.homeRest,g.homeCoach,g.homeQb)+'</div>'+dataQuality(g)+'<div class="ctx-detail-source">Context row synced: '+esc(g.contextSyncedAt||'never')+'.</div></section>'
  }
  function placeholderHtml(message,bad){return '<section class="detail-card ctx-detail" data-context-panel="placeholder"><h3>Context Intelligence</h3><div class="'+(bad?'ctx-error':'ctx-loading')+'">'+esc(message)+'</div></section>'}
  function miniHtml(g){var obs=(g&&g.observations||[]).slice(0,3);var status=g&&g.quality?(g.quality.loaded+'/'+g.quality.total+' fields'):'not loaded';return '<div class="ctx-mini"><div class="ctx-mini-head"><span class="ctx-mini-title">Context</span><span class="ctx-mini-note">'+esc(status)+'</span></div>'+(obs.length?obs.map(obsHtml).join(''):'<div class="ctx-sub">No notable context flags. Open game for source details.</div>')+'</div>'}
  function renderDetail(){
    var detail=document.querySelector('.detail-content');if(!detail)return;
    var codes=detailCodes();if(!codes)return;
    var existing=detail.querySelector('.ctx-detail');var panel;
    if(ctxError)panel=placeholderHtml('Context data could not load: '+ctxError,true);
    else if(!ctxData)panel=placeholderHtml('Loading Context Intelligence…',false);
    else {var g=findGame(codes[0],codes[1]);panel=g?detailHtml(g):placeholderHtml('Context API loaded, but '+codes[0]+' @ '+codes[1]+' was not found in the current-week Context payload.',true)}
    if(existing){if(existing.outerHTML!==panel)existing.outerHTML=panel;return}
    detail.insertAdjacentHTML('afterbegin',panel)
  }
  function decorateCards(){
    document.querySelectorAll('.game-card').forEach(function(card){
      var old=card.querySelector('.ctx-mini');if(old)old.remove();
      if(!ctxData)return;
      var codes=[].map.call(card.querySelectorAll('.team-code'),function(n){return n.textContent.trim()});
      if(codes.length>=2){var g=findGame(codes[0],codes[1]);if(g)card.insertAdjacentHTML('beforeend',miniHtml(g))}
    })
  }
  function decorate(){renderDetail();decorateCards();addToolButton()}
  async function getJson(url,options){var r=await fetch(url,Object.assign({cache:'no-store',credentials:'same-origin'},options||{}));var b=await r.json().catch(function(){return {error:'Invalid JSON response'}});if(!r.ok)throw new Error(b.message||b.error||('HTTP '+r.status));return b}
  async function ensureData(force){
    if(loading)return;loading=true;ctxError=null;renderDetail();
    try{
      var d=await getJson('/api/dashboard/nfl');if(!d||!d.season||!d.week)throw new Error('Dashboard season/week unavailable');
      var key=d.season+'-'+d.week;if(!force&&ctxData&&ctxKey===key){decorate();return}
      ctxData=await getJson('/api/context/nfl?season='+encodeURIComponent(d.season)+'&week='+encodeURIComponent(d.week));ctxKey=key;ctxError=null;decorate()
    }catch(e){ctxData=null;ctxError=e&&e.message?e.message:String(e);decorate()}
    finally{loading=false}
  }
  function addToolButton(){var section=[].find.call(document.querySelectorAll('.section'),function(s){return /Manual Actions/i.test(s.textContent||'')});if(!section||section.querySelector('[data-context-sync]'))return;var b=document.createElement('button');b.className='tool-action';b.setAttribute('data-context-sync','1');b.innerHTML='<span class="tool-icon">◇</span><span><span class="tool-name">Update Context</span><span class="tool-desc">Refresh nflverse, nfldata and kickoff weather. Free context data; does not change picks.</span><span class="ctx-sync-status" data-context-status>Ready</span></span><span class="chev">›</span>';b.addEventListener('click',runSync);var actions=section.querySelectorAll('.tool-action');if(actions.length)actions[actions.length-1].insertAdjacentElement('afterend',b);else section.appendChild(b)}
  function summaryText(b){
    var d=b&&b.diagnostics||{},nv=d.nflverse||{},ng=d.nfldataGames||{},ns=d.nfldataTeamStats||{},om=d.openMeteo||{};
    return JSON.stringify({
      status:'Context Update Complete',storedGames:d.storedGames||0,
      nflverse:{matched:nv.matchedGames||0,rows:nv.rowsReturned||0,unmatched:nv.unmatchedGames||[]},
      nfldataGames:{matched:ng.matchedGames||0,rows:ng.rowsReturned||0,unmatched:ng.unmatchedGames||[]},
      nfldataTeamStats:{advancedTeams:ns.teamsWithAdvancedMetrics||0,sourceRows:ns.sourceRows||0,teamsStored:ns.teamsStored||0},
      openMeteo:{forecastsStored:om.forecastsStored||0,unavailable:om.skippedOrUnavailable||0,failed:om.failed||0,noForecastGames:om.noForecastGames||[]},
      errors:b&&b.errors||[]
    },null,2)
  }
  async function runSync(ev){var btn=ev.currentTarget,out=document.getElementById('toolResult'),status=btn.querySelector('[data-context-status]');btn.disabled=true;if(status)status.textContent='⏳ Updating Context…';if(out)out.textContent='⏳ Updating Context Intelligence…';try{var d=await getJson('/api/dashboard/nfl');var b=await getJson('/api/context/sync?season='+encodeURIComponent(d.season)+'&week='+encodeURIComponent(d.week),{method:'POST'});if(status)status.textContent='✅ Context Updated';if(out)out.textContent=summaryText(b);await ensureData(true)}catch(e){if(status)status.textContent='❌ Context Update Failed';if(out)out.textContent='❌ Context Update Failed: '+e.message;ctxError=e.message;decorate()}finally{btn.disabled=false}}
  var root=document.getElementById('app')||document.documentElement;new MutationObserver(function(){decorate();if(!ctxData&&!loading&&!ctxError)ensureData(false)}).observe(root,{childList:true,subtree:true});
  decorate();ensureData(false);
})();
</script>`;
  return html.replace("</body>", extension+"\n</body>");
}
