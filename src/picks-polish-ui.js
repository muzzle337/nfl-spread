export function withPicksPolishUi(html){
  if(typeof html!=="string")return html;
  const ext=`
<style>
.pool17-scoreline{font-size:9px;font-weight:900;margin-top:6px}.pool17-scoreline.CORRECT{color:#72dc66}.pool17-scoreline.WRONG{color:#ff8b8b}.pool17-scoreline.TIE{color:#f1c84b}.pool17-season{border:1px solid rgba(76,166,255,.2);background:rgba(76,166,255,.06);border-radius:11px;padding:9px 10px;margin-bottom:10px;font-size:10px;color:#aab6c1}.pool17-season b{color:#eaf2f8}
</style>
<script>
(function(){
 var busy=false,last='',gradedView=null;
 function fixNav(){
  var nav=document.querySelector('.bottom-nav');if(!nav)return;
  var buttons=[].slice.call(nav.querySelectorAll('.nav-btn'));
  var focus=buttons.find(function(b){return /Focus/i.test(b.textContent||'')});if(focus)focus.remove();
  var picks=nav.querySelector('[data-pool17-nav]');var games=[].slice.call(nav.querySelectorAll('.nav-btn')).find(function(b){return /Games/i.test(b.textContent||'')});
  if(picks&&games&&games.nextElementSibling!==picks)nav.insertBefore(picks,games.nextElementSibling);
 }
 async function grade(force){
  var wrap=document.querySelector('.pool17-wrap');if(!wrap||busy)return;
  if(!force&&gradedView===wrap)return;
  gradedView=wrap;busy=true;
  try{
   var r=await fetch('/api/pool/outlooks',{cache:'no-store',credentials:'same-origin'});if(!r.ok)return;var d=await r.json();
   var key=JSON.stringify([d.summary,d.games&&d.games.map(function(g){return[g.gameId,g.pickResult]})]);if(key===last)return;last=key;
   var old=wrap.querySelector('[data-pool17-season]');if(old)old.remove();
   if(d.summary){var s=d.summary,box=document.createElement('div');box.className='pool17-season';box.setAttribute('data-pool17-season','1');box.innerHTML='<b>Season pool:</b> '+s.correct+' correct · '+s.wrong+' wrong'+(s.accuracy!=null?' · '+s.accuracy+'%':'')+(s.pending?' · '+s.pending+' pending':'');var head=wrap.querySelector('.pool17-head');if(head)head.insertAdjacentElement('afterend',box)}
   (d.games||[]).forEach(function(g){var card=wrap.querySelector('[data-pool17-game="'+g.gameId+'"]');if(!card)return;var oldScore=card.querySelector('[data-pool17-score]');if(oldScore)oldScore.remove();if(!g.pickResult)return;var x=document.createElement('div');x.className='pool17-scoreline '+g.pickResult;x.setAttribute('data-pool17-score','1');x.textContent=g.pickResult==='CORRECT'?'✓ Correct':g.pickResult==='WRONG'?'✕ Wrong':'Push / tie';card.appendChild(x)})
  }catch(e){}finally{busy=false}
 }
 function tick(){fixNav();grade(false)}
 var i=0,t=setInterval(function(){tick();i++;if(i>40)clearInterval(t)},250);
 document.addEventListener('click',function(ev){
  setTimeout(function(){fixNav();var target=ev.target&&ev.target.closest?ev.target.closest('[data-pool17-nav],[data-pool17-pick]'):null;if(target)grade(true);else grade(false)},120)
 },true);
})();
</script>`;
 return html.includes('</body>')?html.replace('</body>',ext+'</body>'):html+ext;
}
