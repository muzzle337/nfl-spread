export function dashboardPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#090d12" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <title>NFL Spread Tool</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #080b10;
      --panel: #0e141c;
      --panel-2: #121a24;
      --panel-3: #17212d;
      --border: #233041;
      --text: #f4f7fb;
      --muted: #8c9aaa;
      --blue: #4ca6ff;
      --blue-soft: rgba(76,166,255,.12);
      --green: #72dc66;
      --green-soft: rgba(114,220,102,.12);
      --yellow: #f1c84b;
      --yellow-soft: rgba(241,200,75,.12);
      --gray: #9aa6b3;
      --red: #ff7e7e;
      --radius: 15px;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--text); }
    body { -webkit-font-smoothing: antialiased; }
    button, input { font: inherit; }
    button { color: inherit; }
    .app-shell { width: 100%; max-width: 560px; min-height: 100vh; margin: 0 auto; background: linear-gradient(180deg,#0b1118 0,#080b10 180px); padding-bottom: calc(82px + env(safe-area-inset-bottom)); }
    .topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: calc(14px + env(safe-area-inset-top)) 16px 13px; background: rgba(8,11,16,.94); border-bottom: 1px solid rgba(255,255,255,.06); backdrop-filter: blur(16px); }
    .brand { min-width: 0; }
    .brand-name { font-size: 15px; font-weight: 800; letter-spacing: .02em; }
    .brand-sub { margin-top: 2px; color: var(--muted); font-size: 11px; }
    .season-pill { white-space: nowrap; border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 7px 10px; color: #d9e5f0; font-size: 11px; font-weight: 700; }
    .content { padding: 15px 14px 8px; }
    .section { margin-bottom: 18px; }
    .section-head { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin: 0 2px 9px; }
    .section-title { font-size: 13px; font-weight: 850; letter-spacing: .055em; text-transform: uppercase; }
    .section-meta { color: var(--muted); font-size: 11px; }
    .status-strip { display: flex; align-items: center; gap: 9px; border: 1px solid var(--border); background: var(--panel); border-radius: 13px; padding: 10px 12px; margin-bottom: 14px; color: var(--muted); font-size: 11px; }
    .live-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 4px rgba(114,220,102,.08); flex: 0 0 auto; }
    .focus-empty { border: 1px solid rgba(76,166,255,.28); background: linear-gradient(180deg,rgba(76,166,255,.08),rgba(76,166,255,.03)); border-radius: var(--radius); padding: 15px; }
    .focus-empty strong { display: block; font-size: 14px; }
    .focus-empty p { margin: 5px 0 0; color: var(--muted); font-size: 12px; line-height: 1.45; }
    .focus-list { display: grid; gap: 8px; }
    .focus-row { width: 100%; display: grid; grid-template-columns: 42px 1fr auto; gap: 10px; align-items: center; text-align: left; border: 1px solid var(--border); background: var(--panel); border-radius: 13px; padding: 10px; cursor: pointer; }
    .grade { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; font-size: 21px; font-weight: 900; border: 1px solid currentColor; }
    .grade-A { color: var(--green); background: var(--green-soft); }
    .grade-B { color: var(--yellow); background: var(--yellow-soft); }
    .grade-C { color: #c1c8d0; background: rgba(193,200,208,.08); }
    .focus-main { min-width: 0; }
    .focus-match { font-size: 13px; font-weight: 800; }
    .focus-detail { margin-top: 3px; color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .focus-rate { color: var(--blue); font-weight: 850; font-size: 13px; }
    .filters { display: flex; gap: 7px; overflow-x: auto; padding: 1px 1px 9px; scrollbar-width: none; }
    .filters::-webkit-scrollbar { display: none; }
    .filter { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 7px 11px; color: var(--muted); font-size: 11px; font-weight: 800; cursor: pointer; }
    .filter.active { border-color: rgba(76,166,255,.6); background: var(--blue); color: #06111b; }
    .games { display: grid; gap: 9px; }
    .game-card { width: 100%; border: 1px solid var(--border); background: linear-gradient(180deg,var(--panel-2),var(--panel)); border-radius: var(--radius); padding: 12px; text-align: left; cursor: pointer; box-shadow: 0 8px 28px rgba(0,0,0,.13); }
    .game-top { display: grid; grid-template-columns: minmax(0,1fr) auto minmax(0,1fr); align-items: center; gap: 9px; }
    .team { min-width: 0; display: flex; align-items: center; gap: 8px; }
    .team.home { justify-content: flex-end; text-align: right; }
    .team-logo { width: 38px; height: 38px; object-fit: contain; flex: 0 0 auto; filter: drop-shadow(0 3px 7px rgba(0,0,0,.35)); }
    .team-code { font-size: 14px; font-weight: 900; }
    .team-name { margin-top: 1px; color: var(--muted); font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
    .at { color: #647283; font-size: 11px; font-weight: 800; }
    .kickoff { text-align: center; color: var(--muted); font-size: 10px; margin: 8px 0 9px; }
    .game-data { display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 7px; border-top: 1px solid rgba(255,255,255,.06); padding-top: 10px; }
    .metric { min-width: 0; }
    .metric-label { color: #6f7f90; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
    .metric-value { margin-top: 3px; font-size: 12px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .metric-value.primary { color: var(--blue); font-size: 13px; }
    .game-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 9px; }
    .market-range { color: var(--muted); font-size: 10px; }
    .grade-chip { border-radius: 7px; padding: 3px 7px; font-size: 10px; font-weight: 900; }
    .empty { border: 1px dashed var(--border); border-radius: var(--radius); padding: 28px 16px; text-align: center; color: var(--muted); font-size: 12px; line-height: 1.55; }
    .bottom-nav { position: fixed; left: 50%; bottom: 0; transform: translateX(-50%); width: 100%; max-width: 560px; z-index: 30; display: grid; grid-template-columns: repeat(4,1fr); padding: 7px 7px calc(7px + env(safe-area-inset-bottom)); background: rgba(7,10,14,.96); border-top: 1px solid rgba(255,255,255,.08); backdrop-filter: blur(18px); }
    .nav-btn { border: 0; background: transparent; color: #718091; padding: 6px 3px; cursor: pointer; }
    .nav-icon { display: block; font-size: 19px; line-height: 1; margin-bottom: 4px; }
    .nav-label { display: block; font-size: 9px; font-weight: 800; }
    .nav-btn.active { color: var(--blue); }
    .detail { min-height: 100vh; background: var(--bg); }
    .detail-head { position: sticky; top: 0; z-index: 25; display: grid; grid-template-columns: 42px 1fr 42px; align-items: center; padding: calc(11px + env(safe-area-inset-top)) 9px 11px; background: rgba(8,11,16,.96); border-bottom: 1px solid rgba(255,255,255,.07); }
    .icon-btn { width: 40px; height: 40px; border: 0; border-radius: 50%; background: transparent; color: #dbe6ef; font-size: 24px; cursor: pointer; }
    .detail-title { text-align: center; font-size: 13px; font-weight: 850; }
    .detail-sub { color: var(--muted); font-size: 10px; margin-top: 2px; font-weight: 500; }
    .match-hero { padding: 24px 20px 18px; display: grid; grid-template-columns: 1fr 42px 1fr; align-items: center; text-align: center; }
    .hero-team .team-logo { width: 72px; height: 72px; }
    .hero-code { font-size: 20px; font-weight: 950; margin-top: 5px; }
    .hero-at { color: var(--muted); font-weight: 850; }
    .detail-content { padding: 0 14px 28px; }
    .detail-card { border: 1px solid var(--border); background: var(--panel); border-radius: var(--radius); padding: 14px; margin-bottom: 10px; }
    .detail-card h3 { margin: 0 0 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .055em; }
    .key-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 12px; }
    .key-label { color: var(--muted); font-size: 10px; }
    .key-value { font-weight: 850; font-size: 14px; margin-top: 3px; }
    .key-value.blue { color: var(--blue); }
    .key-value.yellow { color: var(--yellow); }
    .stats-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 7px; }
    .stat-box { border: 1px solid rgba(255,255,255,.06); background: var(--panel-2); border-radius: 10px; padding: 10px 6px; text-align: center; }
    .stat-label { color: var(--muted); font-size: 9px; }
    .stat-value { margin-top: 4px; font-size: 13px; font-weight: 850; }
    .outlook { color: #ccd6df; font-size: 12px; line-height: 1.5; }
    .book-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .book-table th { color: var(--muted); font-size: 9px; text-transform: uppercase; text-align: left; padding: 0 4px 8px; font-weight: 750; }
    .book-table td { padding: 9px 4px; border-top: 1px solid rgba(255,255,255,.055); }
    .book-table td:nth-child(2), .book-table td:nth-child(3), .book-table th:nth-child(2), .book-table th:nth-child(3) { text-align: right; }
    .tools-intro { border: 1px solid rgba(76,166,255,.28); background: var(--blue-soft); border-radius: var(--radius); padding: 14px; margin-bottom: 12px; }
    .tools-intro strong { font-size: 13px; }
    .tools-intro p { color: var(--muted); font-size: 11px; line-height: 1.45; margin: 5px 0 0; }
    .admin-key { width: 100%; border: 1px solid var(--border); background: #090e14; color: var(--text); border-radius: 11px; padding: 11px 12px; outline: none; margin-bottom: 9px; }
    .admin-key:focus { border-color: var(--blue); }
    .tool-action { width: 100%; border: 1px solid var(--border); background: var(--panel); border-radius: 13px; display: grid; grid-template-columns: 38px 1fr auto; gap: 10px; align-items: center; padding: 11px; margin-bottom: 8px; text-align: left; cursor: pointer; }
    .tool-icon { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; background: var(--blue-soft); color: var(--blue); font-size: 18px; }
    .tool-action.green .tool-icon { color: var(--green); background: var(--green-soft); }
    .tool-action.yellow .tool-icon { color: var(--yellow); background: var(--yellow-soft); }
    .tool-name { font-size: 12px; font-weight: 850; }
    .tool-desc { color: var(--muted); font-size: 10px; margin-top: 2px; line-height: 1.35; }
    .chev { color: #607184; font-size: 18px; }
    .tool-result { min-height: 54px; white-space: pre-wrap; word-break: break-word; border: 1px solid var(--border); background: #070a0e; border-radius: 12px; padding: 11px; color: #b7c3ce; font-size: 10px; line-height: 1.45; }
    .tool-action:disabled { opacity: .55; cursor: wait; }
    .loading { padding: 80px 20px; text-align: center; color: var(--muted); }
    .spinner { width: 26px; height: 26px; border: 2px solid var(--border); border-top-color: var(--blue); border-radius: 50%; animation: spin .8s linear infinite; margin: 0 auto 12px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (min-width: 700px) {
      body { background: #05070a; }
      .app-shell { border-left: 1px solid rgba(255,255,255,.06); border-right: 1px solid rgba(255,255,255,.06); }
    }
  </style>
</head>
<body>
  <div id="app" class="app-shell"><div class="loading"><div class="spinner"></div>Loading the week…</div></div>
  <script>
    (function () {
      var state = { data: null, tab: 'dashboard', filter: 'ALL', selected: null, loading: true, error: null };
      var app = document.getElementById('app');
      var TEAM = {
        'Arizona Cardinals': ['ARI','ari'], 'Atlanta Falcons': ['ATL','atl'], 'Baltimore Ravens': ['BAL','bal'],
        'Buffalo Bills': ['BUF','buf'], 'Carolina Panthers': ['CAR','car'], 'Chicago Bears': ['CHI','chi'],
        'Cincinnati Bengals': ['CIN','cin'], 'Cleveland Browns': ['CLE','cle'], 'Dallas Cowboys': ['DAL','dal'],
        'Denver Broncos': ['DEN','den'], 'Detroit Lions': ['DET','det'], 'Green Bay Packers': ['GB','gb'],
        'Houston Texans': ['HOU','hou'], 'Indianapolis Colts': ['IND','ind'], 'Jacksonville Jaguars': ['JAX','jax'],
        'Kansas City Chiefs': ['KC','kc'], 'Las Vegas Raiders': ['LV','lv'], 'Los Angeles Chargers': ['LAC','lac'],
        'Los Angeles Rams': ['LAR','lar'], 'Miami Dolphins': ['MIA','mia'], 'Minnesota Vikings': ['MIN','min'],
        'New England Patriots': ['NE','ne'], 'New Orleans Saints': ['NO','no'], 'New York Giants': ['NYG','nyg'],
        'New York Jets': ['NYJ','nyj'], 'Philadelphia Eagles': ['PHI','phi'], 'Pittsburgh Steelers': ['PIT','pit'],
        'San Francisco 49ers': ['SF','sf'], 'Seattle Seahawks': ['SEA','sea'], 'Tampa Bay Buccaneers': ['TB','tb'],
        'Tennessee Titans': ['TEN','ten'], 'Washington Commanders': ['WAS','wsh']
      };
      var SOURCE_NAMES = {
        draftkings: 'DraftKings', fanduel: 'FanDuel', betmgm: 'BetMGM', betrivers: 'BetRivers',
        betonlineag: 'BetOnline', betus: 'BetUS', bovada: 'Bovada', lowvig: 'LowVig', mybookieag: 'MyBookie'
      };

      function esc(value) {
        return String(value === null || value === undefined ? '' : value)
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
      }
      function teamInfo(name) {
        if (TEAM[name]) return { code: TEAM[name][0], slug: TEAM[name][1] };
        var words = String(name || '').trim().split(/\\s+/).filter(Boolean);
        return { code: words.map(function (w) { return w[0]; }).join('').slice(0,3).toUpperCase() || 'NFL', slug: 'nfl' };
      }
      function logo(name) {
        var t = teamInfo(name);
        return 'https://a.espncdn.com/i/teamlogos/nfl/500/' + encodeURIComponent(t.slug) + '.png';
      }
      function signed(n) {
        if (n === null || n === undefined || !Number.isFinite(Number(n))) return '—';
        var v = Number(n);
        if (v === 0) return 'PK';
        return (v > 0 ? '+' : '') + String(v);
      }
      function tierLabel(tier) {
        return tier === 'PICK_EM' ? 'PK' : tier === '<=3' ? '0.5–3' : tier === '<=7' ? '3.5–7' : tier === '>7' ? '7.5+' : '—';
      }
      function classLabel(value) {
        var map = { AwayFav:'Away Favorite', HomeFav:'Home Favorite', AwayDog:'Away Dog', HomeDog:'Home Dog', AwayPickEm:'Away Pick’em', HomePickEm:'Home Pick’em' };
        return map[value] || value || '—';
      }
      function favoriteConsensus(game) {
        var a = Number(game.medianAwaySpread);
        var away = teamInfo(game.awayTeam).code;
        var home = teamInfo(game.homeTeam).code;
        if (!Number.isFinite(a)) return 'No line';
        if (a === 0) return away + ' / ' + home + ' PK';
        return a < 0 ? away + ' ' + signed(a) : home + ' ' + signed(-a);
      }
      function rangeLabel(game) {
        var min = Number(game.minAwaySpread), max = Number(game.maxAwaySpread);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return '—';
        if (min === max) return signed(min);
        return signed(min) + ' to ' + signed(max);
      }
      function kickoffLabel(iso) {
        var d = new Date(iso);
        if (Number.isNaN(d.getTime())) return 'Kickoff TBD';
        return new Intl.DateTimeFormat(undefined, { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }).format(d);
      }
      function shortTeam(name) {
        var words = String(name || '').split(' ');
        return words.length > 1 ? words.slice(-1)[0] : String(name || '');
      }
      function gradeCounts() {
        var counts = { A:0, B:0, C:0 };
        (state.data && state.data.games || []).forEach(function (g) { if (counts[g.grade] !== undefined) counts[g.grade] += 1; });
        return counts;
      }
      function filteredGames() {
        var games = state.data && state.data.games || [];
        if (state.filter === 'ALL') return games;
        return games.filter(function (g) { return g.grade === state.filter; });
      }
      function focusGames() {
        var rank = { A:0, B:1, C:2 };
        return (state.data && state.data.games || []).filter(function (g) { return g.focus; }).sort(function (a,b) {
          var grade = (rank[a.grade] === undefined ? 9 : rank[a.grade]) - (rank[b.grade] === undefined ? 9 : rank[b.grade]);
          if (grade) return grade;
          return Number(b.projectedCoverRate || 0) - Number(a.projectedCoverRate || 0);
        });
      }
      function gradeChip(grade) {
        if (!grade) return '';
        return '<span class="grade-chip grade-' + esc(grade) + '">' + esc(grade) + '</span>';
      }
      function card(game) {
        var away = teamInfo(game.awayTeam), home = teamInfo(game.homeTeam);
        var classification = game.classification ? classLabel(game.classification.away) + ' / ' + classLabel(game.classification.home) : 'Waiting for data';
        var status = game.projectionStatus === 'READY' ? (esc(game.projectedTeam) + ' · ' + esc(game.projectedCoverRate) + '%') : 'No 2026 projection yet';
        return '<button class="game-card" data-game="' + esc(game.id) + '">' +
          '<div class="game-top">' +
            '<div class="team"><img class="team-logo" alt="" src="' + logo(game.awayTeam) + '"><div><div class="team-code">' + esc(away.code) + '</div><div class="team-name">' + esc(shortTeam(game.awayTeam)) + '</div></div></div>' +
            '<div class="at">@</div>' +
            '<div class="team home"><div><div class="team-code">' + esc(home.code) + '</div><div class="team-name">' + esc(shortTeam(game.homeTeam)) + '</div></div><img class="team-logo" alt="" src="' + logo(game.homeTeam) + '"></div>' +
          '</div>' +
          '<div class="kickoff">' + esc(kickoffLabel(game.kickoffAt)) + '</div>' +
          '<div class="game-data">' +
            '<div class="metric"><div class="metric-label">Consensus</div><div class="metric-value primary">' + esc(favoriteConsensus(game)) + '</div></div>' +
            '<div class="metric"><div class="metric-label">Tier</div><div class="metric-value">' + esc(tierLabel(game.classification && game.classification.tier)) + '</div></div>' +
            '<div class="metric"><div class="metric-label">Class</div><div class="metric-value">' + esc(classification) + '</div></div>' +
          '</div>' +
          '<div class="game-footer"><span class="market-range">Range ' + esc(rangeLabel(game)) + ' · ' + esc(game.bookmakerCount) + ' books · ' + status + '</span>' + gradeChip(game.grade) + '</div>' +
        '</button>';
      }
      function header() {
        var season = state.data && state.data.season ? state.data.season : '—';
        var week = state.data && state.data.week ? state.data.week : '—';
        return '<header class="topbar"><div class="brand"><div class="brand-name">NFL SPREAD TOOL</div><div class="brand-sub">Current-season engine · live market board</div></div><div class="season-pill">' + esc(season) + ' · WEEK ' + esc(week) + '</div></header>';
      }
      function statusStrip() {
        var results = state.data && state.data.results;
        if (!results) return '';
        var text = results.missingFinals > 0 ? (results.missingFinals + ' missing final' + (results.missingFinals === 1 ? '' : 's')) :
          results.weekComplete ? 'Week complete · all finals recorded' :
          (results.completedGames + ' completed · ' + results.awaitingCompletion + ' awaiting kickoff/final');
        return '<div class="status-strip"><span class="live-dot"></span><span>' + esc(text) + '</span></div>';
      }
      function focusSection() {
        var games = focusGames();
        if (!games.length) {
          return '<section class="section"><div class="section-head"><div class="section-title">Focus</div><div class="section-meta">0 games</div></div>' +
            '<div class="focus-empty"><strong>Building the 2026 sample</strong><p>Focus grades activate from completed prior weeks. Week 1 stays neutral instead of inventing confidence.</p></div></section>';
        }
        return '<section class="section"><div class="section-head"><div class="section-title">Focus</div><div class="section-meta">' + games.length + ' game' + (games.length === 1 ? '' : 's') + '</div></div><div class="focus-list">' +
          games.map(function (g) { var a=teamInfo(g.awayTeam).code,h=teamInfo(g.homeTeam).code; return '<button class="focus-row" data-game="' + esc(g.id) + '"><span class="grade grade-' + esc(g.grade) + '">' + esc(g.grade) + '</span><span class="focus-main"><span class="focus-match">' + esc(a) + ' @ ' + esc(h) + '</span><span class="focus-detail">' + esc(favoriteConsensus(g)) + ' · ' + esc(classLabel(g.projectedClassification)) + ' · n=' + esc(g.sampleSize) + '</span></span><span class="focus-rate">' + esc(g.projectedCoverRate) + '%</span></button>'; }).join('') +
          '</div></section>';
      }
      function filters() {
        var counts = gradeCounts();
        return '<div class="filters">' + ['ALL','A','B','C'].map(function (f) { var count = f === 'ALL' ? (state.data.games || []).length : counts[f]; return '<button class="filter ' + (state.filter === f ? 'active' : '') + '" data-filter="' + f + '">' + f.charAt(0) + f.slice(1).toLowerCase() + ' ' + count + '</button>'; }).join('') + '</div>';
      }
      function gamesSection(title) {
        var games = filteredGames();
        return '<section class="section"><div class="section-head"><div class="section-title">' + esc(title) + '</div><div class="section-meta">Week ' + esc(state.data.week) + '</div></div>' + filters() + '<div class="games">' + (games.length ? games.map(card).join('') : '<div class="empty">No games match this filter.</div>') + '</div></section>';
      }
      function dashboardView() {
        return header() + '<main class="content">' + statusStrip() + focusSection() + gamesSection('This Week') + '</main>' + nav();
      }
      function gamesView() {
        return header() + '<main class="content">' + statusStrip() + gamesSection('All Games') + '</main>' + nav();
      }
      function focusView() {
        var games = focusGames();
        return header() + '<main class="content">' + statusStrip() + '<section class="section"><div class="section-head"><div class="section-title">Focus Board</div><div class="section-meta">A / B / C only</div></div>' +
          (games.length ? '<div class="games">' + games.map(card).join('') + '</div>' : '<div class="empty"><strong>No Focus games yet.</strong><br>Once completed prior-week results create a 55%+ bucket, qualifying games will appear here.</div>') + '</section></main>' + nav();
      }
      function nav() {
        var items = [['dashboard','⌂','Dashboard'],['games','▦','Games'],['focus','◎','Focus'],['tools','⚙','Tools']];
        return '<nav class="bottom-nav">' + items.map(function (item) { return '<button class="nav-btn ' + (state.tab === item[0] ? 'active' : '') + '" data-tab="' + item[0] + '"><span class="nav-icon">' + item[1] + '</span><span class="nav-label">' + item[2] + '</span></button>'; }).join('') + '</nav>';
      }
      function toolButton(cls, icon, name, desc, action) {
        return '<button class="tool-action ' + cls + '" data-action="' + action + '"><span class="tool-icon">' + icon + '</span><span><span class="tool-name">' + name + '</span><span class="tool-desc">' + desc + '</span></span><span class="chev">›</span></button>';
      }
      function toolsView() {
        return header() + '<main class="content">' +
          '<div class="tools-intro"><strong>Tools & Admin</strong><p>Routine result checks are automatic. These controls are here when you want to refresh lines, force a guarded final-score check, or verify system health.</p></div>' +
          '<section class="section"><div class="section-head"><div class="section-title">Admin Key</div><div class="section-meta">Stored for this browser session</div></div><input id="adminKey" class="admin-key" type="password" autocomplete="current-password" placeholder="Enter admin key"></section>' +
          '<section class="section"><div class="section-head"><div class="section-title">Manual Actions</div></div>' +
            toolButton('', '↻', 'Update Lines', 'Pull the latest sportsbook spreads. Normally 1 API credit.', 'spreads') +
            toolButton('green', '✓', 'Check Final Scores', 'D1 checks first; the paid score API is only called when a final is due.', 'results') +
            toolButton('yellow', '!', 'Results Integrity', 'Check for overdue or stale missing finals without spending API credits.', 'integrity') +
            toolButton('', '▥', 'API Usage', 'View tracked requests, credits used, and remaining quota.', 'usage') +
          '</section>' +
          '<section class="section"><div class="section-head"><div class="section-title">Output</div></div><div id="toolResult" class="tool-result">Ready.</div></section>' +
        '</main>' + nav();
      }
      function detailView(game) {
        var away=teamInfo(game.awayTeam),home=teamInfo(game.homeTeam);
        var awayStat=game.currentSeasonStats && game.currentSeasonStats.away, homeStat=game.currentSeasonStats && game.currentSeasonStats.home;
        var outlook = game.projectionStatus === 'READY' ? ('Current-season data points to ' + game.projectedTeam + ' (' + game.projectedClassification + ') at ' + game.projectedCoverRate + '% across ' + game.sampleSize + ' decision' + (game.sampleSize === 1 ? '' : 's') + '.') :
          game.projectionStatus === 'NO_EDGE' ? 'Both sides currently have the same cover rate. No edge is being assigned.' :
          'Waiting for completed prior-week 2026 results. The market data is live, but the projection engine is intentionally neutral.';
        var books=(game.books || []).slice().sort(function(a,b){ return String(a.source).localeCompare(String(b.source)); });
        return '<div class="detail"><header class="detail-head"><button class="icon-btn" data-back="1">‹</button><div class="detail-title">' + esc(away.code) + ' @ ' + esc(home.code) + '<div class="detail-sub">Week ' + esc(game.week) + '</div></div><div></div></header>' +
          '<div class="match-hero"><div class="hero-team"><img class="team-logo" alt="" src="' + logo(game.awayTeam) + '"><div class="hero-code">' + esc(away.code) + '</div></div><div class="hero-at">@</div><div class="hero-team"><img class="team-logo" alt="" src="' + logo(game.homeTeam) + '"><div class="hero-code">' + esc(home.code) + '</div></div></div>' +
          '<main class="detail-content"><div class="kickoff">' + esc(kickoffLabel(game.kickoffAt)) + '</div>' +
            '<section class="detail-card"><h3>Key Info</h3><div class="key-grid">' +
              '<div><div class="key-label">Consensus</div><div class="key-value blue">' + esc(favoriteConsensus(game)) + '</div></div>' +
              '<div><div class="key-label">Market Range</div><div class="key-value">' + esc(rangeLabel(game)) + '</div></div>' +
              '<div><div class="key-label">Away Classification</div><div class="key-value">' + esc(classLabel(game.classification && game.classification.away)) + '</div></div>' +
              '<div><div class="key-label">Tier</div><div class="key-value yellow">' + esc(tierLabel(game.classification && game.classification.tier)) + '</div></div>' +
            '</div></section>' +
            '<section class="detail-card"><h3>Projected · Current Season</h3><div class="stats-grid">' +
              '<div class="stat-box"><div class="stat-label">Away Cover</div><div class="stat-value">' + esc(awayStat && awayStat.coverRate !== null ? awayStat.coverRate + '%' : '—') + '</div></div>' +
              '<div class="stat-box"><div class="stat-label">Home Cover</div><div class="stat-value">' + esc(homeStat && homeStat.coverRate !== null ? homeStat.coverRate + '%' : '—') + '</div></div>' +
              '<div class="stat-box"><div class="stat-label">Sample</div><div class="stat-value">' + esc(game.sampleSize || 0) + '</div></div>' +
              '<div class="stat-box"><div class="stat-label">Projected</div><div class="stat-value">' + esc(game.projectedSide || '—') + '</div></div>' +
              '<div class="stat-box"><div class="stat-label">Cover %</div><div class="stat-value">' + esc(game.projectedCoverRate !== null ? game.projectedCoverRate + '%' : '—') + '</div></div>' +
              '<div class="stat-box"><div class="stat-label">Grade</div><div class="stat-value">' + esc(game.grade || '—') + '</div></div>' +
            '</div></section>' +
            '<section class="detail-card"><h3>Game Outlook</h3><div class="outlook">' + esc(outlook) + '</div></section>' +
            '<section class="detail-card"><h3>Sportsbook Lines · ' + esc(game.bookmakerCount) + '</h3>' +
              (books.length ? '<table class="book-table"><thead><tr><th>Book</th><th>' + esc(away.code) + '</th><th>' + esc(home.code) + '</th></tr></thead><tbody>' + books.map(function(b){ return '<tr><td>' + esc(SOURCE_NAMES[b.source] || b.source) + '</td><td>' + esc(signed(b.awaySpread)) + '</td><td>' + esc(signed(Number(b.awaySpread) === 0 ? 0 : -Number(b.awaySpread))) + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">No sportsbook lines available.</div>') +
            '</section>' +
          '</main></div>';
      }
      function render() {
        if (state.loading) { app.innerHTML = '<div class="loading"><div class="spinner"></div>Loading the week…</div>'; return; }
        if (state.error) { app.innerHTML = '<div class="loading"><strong>Dashboard unavailable</strong><br><br>' + esc(state.error) + '</div>'; return; }
        if (state.selected) {
          var game=(state.data.games || []).find(function(g){return g.id===state.selected;});
          if (game) { app.innerHTML=detailView(game); bind(); return; }
          state.selected=null;
        }
        if (!state.data || !state.data.games || !state.data.games.length) { app.innerHTML = header() + '<main class="content"><div class="empty">No NFL games are stored yet. Run spread ingestion from Tools.</div></main>' + nav(); bind(); return; }
        app.innerHTML = state.tab === 'games' ? gamesView() : state.tab === 'focus' ? focusView() : state.tab === 'tools' ? toolsView() : dashboardView();
        bind();
        if (state.tab === 'tools') {
          var key=document.getElementById('adminKey');
          if (key) key.value=sessionStorage.getItem('nflSpreadAdminToken') || '';
        }
      }
      function bind() {
        app.querySelectorAll('[data-tab]').forEach(function(btn){ btn.addEventListener('click',function(){state.tab=btn.getAttribute('data-tab');state.selected=null;render();}); });
        app.querySelectorAll('[data-filter]').forEach(function(btn){ btn.addEventListener('click',function(){state.filter=btn.getAttribute('data-filter');render();}); });
        app.querySelectorAll('[data-game]').forEach(function(btn){ btn.addEventListener('click',function(){state.selected=btn.getAttribute('data-game');render();window.scrollTo(0,0);}); });
        app.querySelectorAll('[data-back]').forEach(function(btn){ btn.addEventListener('click',function(){state.selected=null;render();}); });
        app.querySelectorAll('[data-action]').forEach(function(btn){ btn.addEventListener('click',function(){runTool(btn.getAttribute('data-action'));}); });
      }
      function setToolOutput(text) { var el=document.getElementById('toolResult'); if(el) el.textContent=text; }
      function setToolsDisabled(disabled) { app.querySelectorAll('[data-action]').forEach(function(b){b.disabled=disabled;}); }
      async function runTool(action) {
        var path, options={};
        if (action === 'integrity') path='/api/results/integrity';
        else if (action === 'usage') path='/api/usage';
        else {
          var keyEl=document.getElementById('adminKey');
          var token=keyEl ? keyEl.value.trim() : '';
          if (!token) { setToolOutput('Enter the admin key first.'); return; }
          sessionStorage.setItem('nflSpreadAdminToken',token);
          path=action === 'results' ? '/api/ingest/nfl/results' : '/api/ingest/nfl';
          options={method:'POST',headers:{'x-admin-token':token}};
        }
        setToolsDisabled(true); setToolOutput('Running…');
        try {
          var response=await fetch(path,options); var body=await response.json().catch(function(){return {error:'Invalid response'};});
          setToolOutput(JSON.stringify(body,null,2));
          if (response.ok && (action === 'spreads' || action === 'results')) await load(false);
        } catch (e) { setToolOutput(JSON.stringify({error:e.message},null,2)); }
        finally { setToolsDisabled(false); }
      }
      async function load(showLoading) {
        if (showLoading !== false) { state.loading=true; render(); }
        try {
          var response=await fetch('/api/dashboard/nfl',{headers:{accept:'application/json'},cache:'no-store'});
          var body=await response.json();
          if (!response.ok) throw new Error(body.message || body.error || 'Unable to load dashboard');
          state.data=body; state.error=null;
        } catch(e) { state.error=e.message; }
        state.loading=false; render();
      }
      load(true);
    })();
  </script>
</body>
</html>`;
}
