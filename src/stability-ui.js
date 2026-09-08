export function withStabilityUi(html){
  if(typeof html!=="string")return html;
  const ext=`
<style>
.stab18-banner{border:1px solid rgba(255,126,126,.25);background:rgba(255,126,126,.07);border-radius:11px;padding:10px 12px;margin-bottom:12px;color:#ffb0b0;font-size:10px;line-height:1.45}.stab18-banner b{color:#ffd3d3}
</style>
<script>
(function(){
  var lastView='';
  function activeLabel(){var a=document.querySelector('.nav-btn.active');return String(a&&a.textContent||'').trim().toLowerCase()}
  function currentView(){
    if(document.querySelector('.pool17-wrap,[data-pool17-view]'))return 'picks';
    if(document.querySelector('.detail,.detail-content'))return 'detail';
    var label=activeLabel();
    if(label.indexOf('tools')>=0)return 'tools';
    if(label.indexOf('survivor')>=0)return 'survivor';
    if(label.indexOf('games')>=0)return 'games';
    if(label.indexOf('picks')>=0)return 'picks';
    return 'dashboard';
  }
  function keepOne(selector){var nodes=[].slice.call(document.querySelectorAll(selector));nodes.slice(1).forEach(function(n){n.remove()})}
  function isolate(){
    var view=currentView();document.documentElement.setAttribute('data-app-view',view);lastView=view;
    keepOne('.ctx14-board');keepOne('.hist16-board');
    if(view!=='dashboard')document.querySelectorAll('.ctx14-board,.hist16-board').forEach(function(n){n.remove()});
    if(view==='picks')document.querySelectorAll('.ctx14-mini,[data-ctx14-mini],[data-hist16-board],[data-ctx14-board]').forEach(function(n){n.remove()});
  }
  function safeRun(){try{isolate()}catch(e){console.error('stability-ui',e)}}
  document.addEventListener('click',function(){setTimeout(safeRun,0);setTimeout(safeRun,100)},true);
  window.addEventListener('pageshow',safeRun);
  window.addEventListener('popstate',safeRun);
  var ticks=0,boot=setInterval(function(){safeRun();ticks++;if(ticks>=40)clearInterval(boot)},250);
  setInterval(safeRun,2000);
})();
</script>`;
  return html.includes('</body>')?html.replace('</body>',ext+'</body>'):html+ext;
}
