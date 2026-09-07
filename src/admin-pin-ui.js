export function withAdminPinUi(html) {
  if (typeof html !== "string") return html;
  const extension = `
<style>
  .admin-pin-card{border:1px solid #233041;background:#0e141c;border-radius:15px;padding:13px;margin-bottom:12px}
  .admin-pin-status{font-size:12px;font-weight:850}.admin-pin-status.ok{color:#72dc66}.admin-pin-status.locked{color:#f1c84b}
  .admin-pin-note{color:#8c9aaa;font-size:10px;line-height:1.45;margin-top:4px}
  .admin-pin-row{display:flex;gap:8px;margin-top:10px}.admin-pin-row input{flex:1;min-width:0;border:1px solid #233041;background:#090e14;color:#f4f7fb;border-radius:11px;padding:10px 11px;outline:none}.admin-pin-row input:focus{border-color:#4ca6ff}
  .admin-pin-btn{border:1px solid #233041;background:#121a24;color:#f4f7fb;border-radius:10px;padding:9px 11px;font-size:10px;font-weight:850;cursor:pointer}.admin-pin-btn.danger{color:#ff9b9b}
  .admin-key-replaced .admin-key{display:none}
</style>
<script>
(function(){
  var auth={configured:true,authenticated:false,expiresAt:null,loaded:false};
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;')}
  function setOutput(text){var el=document.getElementById('toolResult');if(el)el.textContent=text}
  async function sessionRequest(path,options){var r=await fetch(path,Object.assign({credentials:'same-origin',cache:'no-store'},options||{}));var b=await r.json().catch(function(){return {error:'Invalid response'}});if(!r.ok)throw new Error(b.error||b.message||'Request failed');return b}
  async function refreshStatus(){try{var b=await sessionRequest('/api/admin/session');auth={configured:b.configured!==false,authenticated:b.authenticated===true,expiresAt:b.expiresAt||null,loaded:true}}catch(_){auth={configured:false,authenticated:false,expiresAt:null,loaded:true}}mount()}
  function sessionText(){if(!auth.configured)return '<div class="admin-pin-status locked">PIN setup required</div><div class="admin-pin-note">Add the Cloudflare secret ADMIN_UI_PIN once, then return here.</div>';if(auth.authenticated)return '<div class="admin-pin-status ok">✓ Admin Tools Unlocked</div><div class="admin-pin-note">Trusted on this device for up to 30 days. The real admin key stays in Cloudflare.</div><div class="admin-pin-row"><button class="admin-pin-btn danger" data-admin-lock>Lock Tools</button></div>';return '<div class="admin-pin-status locked">🔒 Admin Tools Locked</div><div class="admin-pin-note">Enter your PIN. The admin key and Odds API key are never stored in this browser.</div><div class="admin-pin-row"><input data-admin-pin type="password" inputmode="numeric" autocomplete="current-password" placeholder="Enter PIN"><button class="admin-pin-btn" data-admin-unlock>Unlock</button></div>'}
  function mount(){var old=document.getElementById('adminKey');if(!old)return;var section=old.closest('.section');if(!section)return;section.classList.add('admin-key-replaced');section.innerHTML='<div class="section-head"><div class="section-title">Admin Access</div><div class="section-meta">Secure device session</div></div><div class="admin-pin-card">'+sessionText()+'</div>';bindSection(section)}
  function bindSection(section){var unlock=section.querySelector('[data-admin-unlock]');var input=section.querySelector('[data-admin-pin]');if(input)input.addEventListener('keydown',function(e){if(e.key==='Enter'&&unlock)unlock.click()});if(unlock)unlock.onclick=async function(){var pin=input&&input.value.trim();if(!pin)return;unlock.disabled=true;try{await sessionRequest('/api/admin/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin:pin})});auth.authenticated=true;setOutput('Admin tools unlocked.');await refreshStatus()}catch(e){setOutput(e.message);if(input){input.value='';input.focus()}}finally{unlock.disabled=false}};var lock=section.querySelector('[data-admin-lock]');if(lock)lock.onclick=async function(){try{await sessionRequest('/api/admin/session',{method:'DELETE'});auth.authenticated=false;setOutput('Admin tools locked.');await refreshStatus()}catch(e){setOutput(e.message)}}}
  async function runProtectedAction(action){if(!auth.authenticated){setOutput('Unlock Admin Tools with your PIN first.');mount();var input=document.querySelector('[data-admin-pin]');if(input)input.focus();return}var path=action==='results'?'/api/ingest/nfl/results':'/api/ingest/nfl';document.querySelectorAll('[data-action]').forEach(function(b){b.disabled=true});setOutput('Running…');try{var b=await sessionRequest(path,{method:'POST'});setOutput(JSON.stringify(b,null,2));if(window.location&&action==='spreads')setTimeout(function(){window.location.reload()},350)}catch(e){setOutput(JSON.stringify({error:e.message},null,2));if(/PIN|required|expired|session/i.test(e.message)){auth.authenticated=false;mount()}}finally{document.querySelectorAll('[data-action]').forEach(function(b){b.disabled=false})}}
  document.addEventListener('click',function(e){var btn=e.target&&e.target.closest&&e.target.closest('[data-action]');if(!btn)return;var action=btn.getAttribute('data-action');if(action!=='spreads'&&action!=='results')return;e.preventDefault();e.stopImmediatePropagation();runProtectedAction(action)},true);
  var root=document.getElementById('app');if(root)new MutationObserver(function(){mount()}).observe(root,{childList:true,subtree:true});
  refreshStatus();
})();
</script>`;
  return html.replace("</body>", `${extension}\n</body>`);
}
