import baseWorker from './v022-entry.js';

const MARKET_CONTEXT = `
<style>
.market-signal-context{margin-top:7px;padding:8px 9px;border-radius:9px;border:1px solid rgba(255,255,255,.08);background:#0a1017;font-size:8px;line-height:1.4}
.market-signal-context strong{display:block;font-size:9px;letter-spacing:.025em;margin-bottom:2px}
.market-signal-context span{display:block;color:#8c9aaa}
.market-signal-context.confirm{border-color:rgba(114,220,102,.30);background:rgba(114,220,102,.07)}
.market-signal-context.confirm strong{color:#72dc66}
.market-signal-context.conflict{border-color:rgba(239,142,142,.30);background:rgba(239,142,142,.07)}
.market-signal-context.conflict strong{color:#ef8e8e}
.market-signal-context.neutral strong{color:#8c9aaa}
.focus-row .market-signal-context{grid-column:2 / 4;margin-top:0}
</style>
<script>
(function(){
  var PATTERN='1+ pt moves: 13–3 ATS · n=16 early sample';
  function n(v){var x=Number(v);return Number.isFinite(x)?x:null}
  function projectedFromGame(card){var el=card.querySelector('.signal-value');if(!el)return '';var m=el.textContent.trim().match(/^([A-Z]{2,4})\\s*·/);return m?m[1]:''}
  function movementFromGame(card){var rows=card.querySelectorAll('.market-move');if(!rows.length)return null;var txt=(rows[0].querySelector('strong')||rows[0]).textContent.trim();var m=txt.match(/([0-9]+(?:\\.[0-9]+)?)\\s*pts?\\s+toward\\s+([A-Z]{2,4})/i);if(m)return {mag:n(m[1]),toward:m[2].toUpperCase()};if(/No movement/i.test(txt))return {mag:0,toward:''};return null}
  function projectedFromFocus(row){var el=row.querySelector('.focus-match');if(!el)return '';var parts=el.textContent.split('·');if(parts.length<2)return '';var m=parts[1].trim().match(/^([A-Z]{2,4})\\b/);return m?m[1]:''}
  function movementFromFocus(row){var el=row.querySelector('.focus-market');if(!el)return null;var txt=el.textContent;var teams=(row.querySelector('.focus-match')||{}).textContent||'';var tm=teams.match(/^([A-Z]{2,4})\\s+@\\s+([A-Z]{2,4})/);if(!tm)return null;var away=tm[1],home=tm[2];var open=txt.match(/Open\\s+[A-Z]{2,4}\\s+([+-]?\\d+(?:\\.\\d+)?)/i);var end=txt.match(/(?:Current|Close)\\s+[A-Z]{2,4}\\s+([+-]?\\d+(?:\\.\\d+)?)/i);if(!open||!end)return null;var a=n(open[1]),b=n(end[1]);if(a===null||b===null)return null;var mag=Math.abs(b-a);return {mag:mag,toward:mag===0?'':(b<a?away:home)} }
  function add(host,projected,movement){
    if(!host||host.querySelector('.market-signal-context')||!projected||!movement||movement.mag===null)return;
    var cls='neutral',title='— NEUTRAL · small move',detail='Under 1 point · informational, not extra weight';
    if(movement.mag>=1&&movement.toward===projected){cls='confirm';title='✓ CONFIRMS TIER';detail=movement.mag+' pt'+(movement.mag===1?'':'s')+' toward '+projected+' · '+PATTERN}
    else if(movement.mag>=1&&movement.toward&&movement.toward!==projected){cls='conflict';title='⚠ CONFLICTS WITH TIER';detail=movement.mag+' pt'+(movement.mag===1?'':'s')+' toward '+movement.toward+' · against '+projected+' tier'}
    var box=document.createElement('div');box.className='market-signal-context '+cls;box.innerHTML='<strong>'+title+'</strong><span>'+detail+'</span>';host.appendChild(box);
  }
  function enhance(){
    document.querySelectorAll('.game-card').forEach(function(card){add(card,projectedFromGame(card),movementFromGame(card))});
    document.querySelectorAll('.focus-row').forEach(function(row){add(row,projectedFromFocus(row),movementFromFocus(row))});
  }
  var queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;enhance()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule);else schedule();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
</script>`;

async function fetchWithMarketContext(request,env,ctx){
  const response=await baseWorker.fetch(request,env,ctx);
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return response;
  const body=await response.text();
  const enhanced=body.includes('</body>')?body.replace('</body>',MARKET_CONTEXT+'</body>'):body+MARKET_CONTEXT;
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  return new Response(enhanced,{status:response.status,statusText:response.statusText,headers});
}

export default {
  fetch:fetchWithMarketContext,
  scheduled(controller,env,ctx){return baseWorker.scheduled(controller,env,ctx)}
};
