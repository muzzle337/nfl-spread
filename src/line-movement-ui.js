const STYLES = `
<style>
  .line-movement-card { overflow:hidden; }
  .lm-summary { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:-2px 0 12px; }
  .lm-direction { color:#4ca6ff; font-size:11px; font-weight:800; }
  .lm-meta { color:#718091; font-size:9px; text-align:right; }
  .lm-steps { display:grid; grid-template-columns:1fr 18px 1fr 18px 1fr; align-items:center; gap:5px; }
  .lm-step { min-width:0; border:1px solid rgba(255,255,255,.065); background:#121a24; border-radius:11px; padding:10px 7px; text-align:center; }
  .lm-step.current { border-color:rgba(76,166,255,.38); background:rgba(76,166,255,.08); }
  .lm-step.close.available { border-color:rgba(114,220,102,.28); }
  .lm-label { color:#718091; font-size:8px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; }
  .lm-value { margin-top:5px; color:#e8eef5; font-size:12px; font-weight:900; white-space:nowrap; }
  .lm-step.current .lm-value { color:#4ca6ff; }
  .lm-arrow { color:#506173; text-align:center; font-size:14px; }
  .lm-note { margin-top:11px; color:#718091; font-size:9px; line-height:1.45; }
  .lm-loading { color:#8c9aaa; font-size:11px; padding:4px 0; }
</style>`;

const SCRIPT = `
<script>
(function () {
  var selectedGameId = null;
  var requestToken = 0;
  var app = document.getElementById('app');
  var CODES = {
    'Arizona Cardinals':'ARI','Atlanta Falcons':'ATL','Baltimore Ravens':'BAL','Buffalo Bills':'BUF',
    'Carolina Panthers':'CAR','Chicago Bears':'CHI','Cincinnati Bengals':'CIN','Cleveland Browns':'CLE',
    'Dallas Cowboys':'DAL','Denver Broncos':'DEN','Detroit Lions':'DET','Green Bay Packers':'GB',
    'Houston Texans':'HOU','Indianapolis Colts':'IND','Jacksonville Jaguars':'JAX','Kansas City Chiefs':'KC',
    'Las Vegas Raiders':'LV','Los Angeles Chargers':'LAC','Los Angeles Rams':'LAR','Miami Dolphins':'MIA',
    'Minnesota Vikings':'MIN','New England Patriots':'NE','New Orleans Saints':'NO','New York Giants':'NYG',
    'New York Jets':'NYJ','Philadelphia Eagles':'PHI','Pittsburgh Steelers':'PIT','San Francisco 49ers':'SF',
    'Seattle Seahawks':'SEA','Tampa Bay Buccaneers':'TB','Tennessee Titans':'TEN','Washington Commanders':'WAS'
  };

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function code(name) { return CODES[name] || String(name || '').split(/\\s+/).map(function(w){return w[0] || '';}).join('').slice(0,3).toUpperCase(); }

  function signed(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
    var number = Number(value);
    if (number === 0) return 'PK';
    return (number > 0 ? '+' : '') + String(number);
  }

  function consensusLabel(awaySpread, awayTeam, homeTeam) {
    if (awaySpread === null || awaySpread === undefined || !Number.isFinite(Number(awaySpread))) return '—';
    var spread = Number(awaySpread), away = code(awayTeam), home = code(homeTeam);
    if (spread === 0) return away + ' / ' + home + ' PK';
    return spread < 0 ? away + ' ' + signed(spread) : home + ' ' + signed(-spread);
  }

  function movementText(data) {
    if (data.movementMagnitude === null || data.movementMagnitude === undefined) return 'Movement unavailable';
    if (data.direction === 'UNCHANGED') return 'Consensus unchanged';
    var team = data.direction === 'TOWARD_AWAY' ? code(data.awayTeam) : code(data.homeTeam);
    return 'Moved ' + data.movementMagnitude + ' pt' + (Number(data.movementMagnitude) === 1 ? '' : 's') + ' toward ' + team;
  }

  function markup(data) {
    var closeAvailable = data.closingAwaySpread !== null && data.closingAwaySpread !== undefined;
    return '<section class="detail-card line-movement-card" data-line-movement="1">' +
      '<h3>Line Movement</h3>' +
      '<div class="lm-summary"><div class="lm-direction">' + esc(movementText(data)) + '</div>' +
      '<div class="lm-meta">' + esc(data.changedBookmakers) + '/' + esc(data.bookmakerCount) + ' books moved · ' + esc(data.snapshotCount) + ' snapshots</div></div>' +
      '<div class="lm-steps">' +
        '<div class="lm-step"><div class="lm-label">First Captured</div><div class="lm-value">' + esc(consensusLabel(data.firstCapturedAwaySpread,data.awayTeam,data.homeTeam)) + '</div></div>' +
        '<div class="lm-arrow">→</div>' +
        '<div class="lm-step current"><div class="lm-label">Current</div><div class="lm-value">' + esc(consensusLabel(data.currentAwaySpread,data.awayTeam,data.homeTeam)) + '</div></div>' +
        '<div class="lm-arrow">→</div>' +
        '<div class="lm-step close ' + (closeAvailable ? 'available' : '') + '"><div class="lm-label">Close</div><div class="lm-value">' + esc(closeAvailable ? consensusLabel(data.closingAwaySpread,data.awayTeam,data.homeTeam) : 'Pending') + '</div></div>' +
      '</div>' +
      '<div class="lm-note">First Captured is the median of the first line this tool stored from each sportsbook. It is not guaranteed to be the sportsbook opening line. Close freezes from the last stored consensus once the result is recorded.</div>' +
    '</section>';
  }

  function insertLoading() {
    var first = document.querySelector('.detail-content .detail-card');
    if (!first || document.querySelector('[data-line-movement]')) return null;
    first.insertAdjacentHTML('afterend','<section class="detail-card line-movement-card" data-line-movement="1"><h3>Line Movement</h3><div class="lm-loading">Loading stored movement…</div></section>');
    return document.querySelector('[data-line-movement]');
  }

  function loadMovement() {
    if (!selectedGameId || !document.querySelector('.detail')) return;
    var existing = document.querySelector('[data-line-movement]');
    if (existing) return;
    var card = insertLoading();
    if (!card) return;
    var token = ++requestToken;
    fetch('/api/lines/movement?game=' + encodeURIComponent(selectedGameId), { cache:'no-store', headers:{accept:'application/json'} })
      .then(function(response){ return response.json().then(function(body){ return {ok:response.ok,body:body}; }); })
      .then(function(result){
        if (token !== requestToken || !document.body.contains(card)) return;
        if (!result.ok || !result.body || !result.body.movement) throw new Error(result.body && result.body.error || 'Movement unavailable');
        card.outerHTML = markup(result.body.movement);
      })
      .catch(function(){
        if (token !== requestToken || !document.body.contains(card)) return;
        card.innerHTML = '<h3>Line Movement</h3><div class="lm-loading">Stored movement is unavailable for this game.</div>';
      });
  }

  document.addEventListener('click', function(event){
    var target = event.target && event.target.closest ? event.target.closest('[data-game]') : null;
    if (target) selectedGameId = target.getAttribute('data-game');
    if (event.target && event.target.closest && event.target.closest('[data-back]')) { selectedGameId = null; requestToken += 1; }
  }, true);

  if (app) new MutationObserver(loadMovement).observe(app, {childList:true, subtree:true});
})();
</script>`;

export function withLineMovementUi(html) {
  if (typeof html !== "string") return html;
  return html.replace("</head>", `${STYLES}\n</head>`).replace("</body>", `${SCRIPT}\n</body>`);
}
