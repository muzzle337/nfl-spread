export function withHistoryUi(html) {
  if (typeof html !== "string") return html;
  const extension = `
<style>
.hist15-status{display:block;color:#718091;font-size:9px;font-weight:800;margin-top:3px}
</style>
<script>
(function(){
  function addHistoryTool(){
    var section=[].find.call(document.querySelectorAll('.section'),function(s){return /Manual Actions/i.test(s.textContent||'')});
    if(!section||section.querySelector('[data-hist15-import]'))return;
    var b=document.createElement('button');b.className='tool-action';b.setAttribute('data-hist15-import','1');
    b.innerHTML='<span class="tool-icon">◫</span><span><span class="tool-name">Load Historical Data</span><span class="tool-desc">Import 2015–2025 NFL game, coach, spread, rest, venue and weather history.</span><span class="hist15-status" data-hist15-status>Ready</span></span><span class="chev">›</span>';
    section.appendChild(b);
  }
  async function runImport(btn){
    var status=btn.querySelector('[data-hist15-status]');btn.disabled=true;if(status)status.textContent='⏳ Loading 2015–2025…';
    var out=document.getElementById('toolResult');
    try{
      var r=await fetch('/api/history/import?start=2015&end=2025',{method:'POST',credentials:'same-origin',cache:'no-store'});
      var body=await r.json().catch(function(){return{error:'Invalid response'}});
      if(!r.ok)throw new Error(body.message||body.error||('HTTP '+r.status));
      if(status)status.textContent='✅ '+body.gamesImported+' games loaded';
      if(out)out.textContent=JSON.stringify(body,null,2);
    }catch(err){if(status)status.textContent='❌ Historical import failed';if(out)out.textContent=String(err&&err.message?err.message:err)}finally{btn.disabled=false}
  }
  document.addEventListener('click',function(ev){var b=ev.target.closest&&ev.target.closest('[data-hist15-import]');if(b){ev.preventDefault();runImport(b);return}if(ev.target.closest&&ev.target.closest('[data-tab]'))setTimeout(addHistoryTool,40)},true);
  addHistoryTool();var ticks=0;var timer=setInterval(function(){addHistoryTool();ticks++;if(ticks>=20)clearInterval(timer)},250);
})();
</script>`;
  return html.includes("</body>") ? html.replace("</body>", extension + "</body>") : html + extension;
}
