const HELP_STYLES = `
<style>
  .help-fab {
    position: fixed;
    z-index: 55;
    right: max(14px, calc((100vw - 560px) / 2 + 14px));
    bottom: calc(82px + env(safe-area-inset-bottom));
    width: 36px;
    height: 36px;
    border: 1px solid #2b3a4d;
    border-radius: 50%;
    background: rgba(14,20,28,.96);
    color: #b9c8d8;
    font: 800 16px/1 system-ui, sans-serif;
    box-shadow: 0 8px 24px rgba(0,0,0,.28);
    cursor: pointer;
  }
  .help-fab:hover { border-color: #4ca6ff; color: #fff; }
  .help-overlay {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: none;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0,0,0,.62);
    backdrop-filter: blur(4px);
  }
  .help-overlay.open { display: flex; }
  .help-sheet {
    width: 100%;
    max-width: 560px;
    max-height: min(82vh, 720px);
    overflow: auto;
    border: 1px solid #243244;
    border-bottom: 0;
    border-radius: 20px 20px 0 0;
    background: #0c1219;
    color: #f4f7fb;
    padding: 15px 15px calc(22px + env(safe-area-inset-bottom));
    box-shadow: 0 -24px 60px rgba(0,0,0,.45);
  }
  .help-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
  .help-title { font: 850 16px/1.2 system-ui, sans-serif; }
  .help-close { width:36px; height:36px; border:0; border-radius:50%; background:#121b26; color:#c9d5e0; font-size:22px; cursor:pointer; }
  .help-kicker { margin:0 0 13px; color:#8c9aaa; font: 11px/1.45 system-ui, sans-serif; }
  .help-steps { display:grid; gap:8px; }
  .help-step { display:grid; grid-template-columns:28px 1fr; gap:9px; padding:10px; border:1px solid #202d3c; border-radius:12px; background:#0f161f; }
  .help-num { display:grid; place-items:center; width:28px; height:28px; border-radius:8px; background:rgba(76,166,255,.12); color:#4ca6ff; font:850 12px/1 system-ui,sans-serif; }
  .help-step strong { display:block; margin-bottom:2px; font:800 12px/1.25 system-ui,sans-serif; }
  .help-step span { display:block; color:#93a2b2; font:10px/1.4 system-ui,sans-serif; }
  .help-note { margin:10px 0; padding:10px 11px; border-left:3px solid #4ca6ff; border-radius:8px; background:rgba(76,166,255,.08); color:#cdd8e2; font:11px/1.45 system-ui,sans-serif; }
  .help-mini-title { margin:15px 0 7px; color:#dce6ef; font:850 11px/1.2 system-ui,sans-serif; text-transform:uppercase; letter-spacing:.05em; }
  .help-grid { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
  .help-chip { padding:9px 10px; border:1px solid #202d3c; border-radius:10px; background:#0f161f; }
  .help-chip strong { display:block; font:800 11px/1.25 system-ui,sans-serif; }
  .help-chip span { display:block; margin-top:2px; color:#8c9aaa; font:9.5px/1.35 system-ui,sans-serif; }
  .help-grades { display:flex; gap:7px; }
  .help-grade { flex:1; padding:9px 7px; text-align:center; border:1px solid #263548; border-radius:10px; background:#101720; font:800 10px/1.25 system-ui,sans-serif; }
  .help-grade b { display:block; font-size:17px; margin-bottom:2px; }
  .help-grade-a b { color:#72dc66; }
  .help-grade-b b { color:#f1c84b; }
  .help-grade-c b { color:#c1c8d0; }
  @media (min-width:700px) {
    .help-sheet { margin-bottom:16px; border-bottom:1px solid #243244; border-radius:20px; }
    .help-overlay { align-items:center; }
  }
</style>`;

const HELP_MARKUP = `
<button id="helpFab" class="help-fab" type="button" aria-label="How this tool works">?</button>
<div id="helpOverlay" class="help-overlay" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
  <section class="help-sheet">
    <div class="help-head"><div id="helpTitle" class="help-title">How This Tool Works</div><button id="helpClose" class="help-close" type="button" aria-label="Close">×</button></div>
    <p class="help-kicker">The short version: it watches the NFL spread market, learns from this season, and highlights matchups that fit stronger patterns.</p>
    <div class="help-steps">
      <div class="help-step"><div class="help-num">1</div><div><strong>Collect the market</strong><span>We pull spread lines from multiple sportsbooks.</span></div></div>
      <div class="help-step"><div class="help-num">2</div><div><strong>Create one consensus line</strong><span>We use the middle of the market instead of trusting one book.</span></div></div>
      <div class="help-step"><div class="help-num">3</div><div><strong>Classify the matchup</strong><span>Home or away, favorite or underdog, plus the spread-size tier.</span></div></div>
      <div class="help-step"><div class="help-num">4</div><div><strong>Learn from 2026 results</strong><span>Completed prior weeks show how each type of team is covering the spread.</span></div></div>
      <div class="help-step"><div class="help-num">5</div><div><strong>Highlight Focus games</strong><span>A matchup enters Focus when its current-season pattern is covering 55% or better.</span></div></div>
    </div>
    <div class="help-note"><strong>Important:</strong> this tool does not predict the final score. It finds current games that match patterns from completed games this season.</div>

    <div class="help-mini-title">Grades</div>
    <div class="help-grades">
      <div class="help-grade help-grade-a"><b>A</b>70%+</div>
      <div class="help-grade help-grade-b"><b>B</b>60–69%</div>
      <div class="help-grade help-grade-c"><b>C</b>55–59%</div>
    </div>

    <div class="help-mini-title">Quick terms</div>
    <div class="help-grid">
      <div class="help-chip"><strong>Consensus</strong><span>The market spread we use.</span></div>
      <div class="help-chip"><strong>Market Range</strong><span>Lowest to highest sportsbook line.</span></div>
      <div class="help-chip"><strong>Tier</strong><span>PK, 0.5–3, 3.5–7, or 7.5+.</span></div>
      <div class="help-chip"><strong>Sample</strong><span>Completed 2026 decisions behind the percentage.</span></div>
    </div>

    <div class="help-mini-title">Tools</div>
    <div class="help-grid">
      <div class="help-chip"><strong>Update Lines</strong><span>Manual fresh sportsbook pull. Lines also refresh automatically.</span></div>
      <div class="help-chip"><strong>Check Finals</strong><span>Checks completed games; paid feed only when a final is due.</span></div>
      <div class="help-chip"><strong>Results Integrity</strong><span>Finds missing finals without API credits.</span></div>
      <div class="help-chip"><strong>API Usage</strong><span>Shows requests and remaining quota.</span></div>
    </div>
  </section>
</div>
<script>
  (function () {
    var fab = document.getElementById('helpFab');
    var overlay = document.getElementById('helpOverlay');
    var close = document.getElementById('helpClose');
    function openHelp() { overlay.classList.add('open'); document.body.style.overflow='hidden'; }
    function closeHelp() { overlay.classList.remove('open'); document.body.style.overflow=''; }
    fab.addEventListener('click', openHelp);
    close.addEventListener('click', closeHelp);
    overlay.addEventListener('click', function (event) { if (event.target === overlay) closeHelp(); });
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape') closeHelp(); });
  })();
</script>`;

export function withHelpGuide(html) {
  if (typeof html !== "string") throw new Error("Dashboard HTML is required");
  return html
    .replace("</head>", `${HELP_STYLES}\n</head>`)
    .replace("</body>", `${HELP_MARKUP}\n</body>`);
}
