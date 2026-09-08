import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { outlookLabel } from "../src/weekly-picks.js";
import { withGameOutlookPicksUi } from "../src/game-outlook-picks-ui.js";
import { withPicksPolishUi } from "../src/picks-polish-ui.js";
import { APP_VERSION } from "../src/v017-entry.js";

const good=(games=20,winPct=70,coverPct=60)=>({games,record:{winPct},spreadRecord:{coverPct}});

test("Game Outlook ranks agreement without manufacturing probability",()=>{
 const game={awayTeam:"A",homeTeam:"B",projectedTeam:"B",moneyline:{awayWinProbability:.35,homeWinProbability:.65}};
 const history={away:{notable:[]},home:{notable:[good()]}};
 const out=outlookLabel(game,history,null);
 assert.equal(out.level,"STRONG AGREEMENT");
 assert.equal(out.team,"B");
 assert.equal("probability" in out,false);
});

test("Game Outlook flags conflicting market and spread/history as mixed",()=>{
 const game={awayTeam:"A",homeTeam:"B",projectedTeam:"A",moneyline:{awayWinProbability:.40,homeWinProbability:.60}};
 const history={away:{notable:[good()]},home:{notable:[]}};
 const out=outlookLabel(game,history,null);
 assert.equal(out.level,"MIXED");
});

test("a historically bad split does not get counted as support for that coach",()=>{
 const game={awayTeam:"A",homeTeam:"B",projectedTeam:null,moneyline:{awayWinProbability:.55,homeWinProbability:.45}};
 const history={away:{notable:[good(20,25,55)]},home:{notable:[]}};
 const out=outlookLabel(game,history,null);
 assert.equal(out.inputs.historical,"B");
 assert.notEqual(out.level,"MODERATE AGREEMENT");
});

test("Weekly Picks UI includes Picks tab, iMessage export, market labels and no MutationObserver",()=>{
 let html=withGameOutlookPicksUi('<!doctype html><html><body><div class="bottom-nav"></div><div id="app"></div></body></html>');
 html=withPicksPolishUi(html);
 assert.match(html,/Picks/);
 assert.match(html,/Copy Detailed/);
 assert.match(html,/Copy Compact/);
 assert.match(html,/market win/);
 assert.match(html,/public pick percentages/);
 assert.match(html,/Season pool/);
 assert.match(html,/Focus/);
 assert.doesNotMatch(html,/MutationObserver/);
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 scripts.forEach(s=>assert.doesNotThrow(()=>new Function(s)));
});

test("Picks view is isolated from dashboard Context watchlist decorators",()=>{
 const html=withGameOutlookPicksUi('<!doctype html><html><body><div class="bottom-nav"></div><div id="app"></div></body></html>');
 assert.match(html,/pool17-wrap detail/);
 assert.match(html,/data-pool17-view=\\?"picks\\?"/);
});

test("v0.17 is deployed as the public wrapper",()=>{
 assert.equal(APP_VERSION,"0.17.0");
 const config=readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");
 assert.match(config,/"main"\s*:\s*"src\/v017-entry\.js"/);
});
