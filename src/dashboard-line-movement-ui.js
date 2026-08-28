const STYLES = `
<style>
  .dashboard-move { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:9px; padding-top:8px; border-top:1px solid rgba(255,255,255,.055); color:#9fb0c1; font-size:10px; font-weight:800; }
  .dashboard-move strong { color:#4ca6ff; font-size:10px; }
  .dashboard-move.major strong { color:#f1c84b; }
  .dashboard-move .move-books { color:#6f7f90; font-size:9px; font-weight:700; }
</style>`;

const SCRIPT = `
<script>
(function () {
  var movementByGame = Object.create(null);
  var loaded = false;
  var loading = false;
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

  function code(name) { return CODES[name] || String(name || '').split(/\\s+/).map(function(w){return w[0] || '';}).join('').slice(0,3).toUpperCase(); }

  function label(move) {
    if (!move || !Number.isFinite(Number(move.movementMagnitude)) || Number(move.movementMagnitude) <= 0) return null;
    var team = move.direction === 'TOWARD_AWAY' ? code(move.awayTeam) : move.direction === 'TOWARD_HOME' ? code(move.homeTeam) : '';
    if (!team) return null;
    return '↗ ' + move.movementMagnitude + ' pt' + (Number(move.movementMagnitude) === 1 ? '' : 's') + ' toward ' + team;
  }

  function decorate() {
    if (!loaded) return;
    var cards = document.querySelectorAll('.game-card[data-game]');
    for (var i = 0; i < cards.length; i += 1) {
      var card = cards[i];
      if (card.querySelector('[data-dashboard-move]')) continue;
      var move = movementByGame[card.getAttribute('data-game')];
      var text = label(move);
      if (!text) continue;
      var row = document.createElement('div');
      row.setAttribute('data-dashboard-move','1');
      row.className = 'dashboard-move' + (Number(move.movementMagnitude) >= 1 ? ' major' : '');
      var strong = document.createElement('strong');
      strong.textContent = text;
      var books = document.createElement('span');
      books.className = 'move-books';
      books.textContent = String(move.changedBookmakers || 0) + '/' + String(move.bookmakerCount || 0) + ' books moved';
      row.appendChild(strong);
      row.appendChild(books);
      card.appendChild(row);
    }
  }

  function load() {
    if (loaded || loading) return;
    loading = true;
    fetch('/api/lines/movement/dashboard', { cache:'no-store', headers:{ accept:'application/json' } })
      .then(function(response){ return response.ok ? response.json() : Promise.reject(new Error('movement')); })
      .then(function(body){
        var list = body && Array.isArray(body.movements) ? body.movements : [];
        for (var i = 0; i < list.length; i += 1) movementByGame[String(list[i].gameId)] = list[i];
        loaded = true;
        loading = false;
        decorate();
      })
      .catch(function(){ loading = false; });
  }

  if (app) new MutationObserver(function(){ decorate(); }).observe(app, { childList:true, subtree:true });
  load();
})();
</script>`;

export function withDashboardLineMovementUi(html) {
  if (typeof html !== "string") return html;
  return html.replace("</head>", `${STYLES}\n</head>`).replace("</body>", `${SCRIPT}\n</body>`);
}
