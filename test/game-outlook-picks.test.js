import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { outlookLabel } from "../src/weekly-picks.js";
import { withGameOutlookPicksUi } from "../src/game-outlook-picks-ui.js";
import { APP_VERSION } from "../src/v017-entry.js";

test("Game Outlook ranks agreement without manufacturing probability",()=>{
 const game={awayTeam:"A",homeTeam:"B",projectedTeam:"B",moneyline:{awayWinProbability:.35,homeWinProbability:.65}};
 const history={away:{notable:[]},home:{notable:[{games:20}]}};
 const out=outlookLabel(game,history,null);
 assert.equal(out.level,"STRONG AGREEMENT");
 assert.equal(out.team,"B");
 assert.equal("probability" in out,false);
});

test("Game Outlook flags conflicting market and spread/history as mixed",()=>{
 const game={awayTeam:"A",homeTeam:"B",projectedTeam:"A",moneyline:{awayWinProbability:.40,homeWinProbability:.60}};
 const history={away:{notable:[{games:10}]},home:{notable:[]}};
 const out=outlookLabel(game,history,null);
 assert.equal(out.level,"MIXED");
});

test("Weekly Picks UI includes Picks tab, iMessage export, market labels and no MutationObserver",()=>{
 const html=withGameOutlookPicksUi('<!doctype html><html><body><div class="bottom-nav"></div><div id="app"></div></body></html>');
 assert.match(html,/Picks/);
 assert.match(html,/Copy Detailed/);
 assert.match(html,/Copy Compact/);
 assert.match(html,/market win/);
 assert.match(html,/public pick percentages/);
 assert.doesNotMatch(html,/MutationObserver/);
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 scripts.forEach(s=>assert.doesNotThrow(()=>new Function(s)));
});

test("v0.17 is deployed as the public wrapper",()=>{
 assert.equal(APP_VERSION,"0.17.0");
 const config=readFileSync(new URL("../wrangler.jsonc",import.meta.url),"utf8");
 assert.match(config,/"main"\s*:\s*"src\/v017-entry\.js"/);
});
