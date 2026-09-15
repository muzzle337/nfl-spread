import { chromium } from '@playwright/test';

const base=process.env.PROD_URL||'https://nfl-spread-api.sanro4.workers.dev';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const FINAL_EXPECTED_AFTER_MS=4*60*60*1000;

function fail(message){throw new Error(message)}

async function cardFor(away,home){
  const cards=page.locator('.game-card');
  const count=await cards.count();
  for(let i=0;i<count;i+=1){
    const card=cards.nth(i),text=await card.innerText();
    if(text.includes(away)&&text.includes(home))return card;
  }
  fail('Card '+away+' @ '+home+' not found');
}

async function verifyFinalCard(away,home,awayScore,homeScore,resultText){
  const card=await cardFor(away,home);
  const status=(await card.locator('.game-state').innerText()).trim();
  if(status!=='FINAL')fail(away+'@'+home+': expected FINAL status, got '+status);
  const scores=await card.locator('.score').allInnerTexts();
  if(scores.length!==2||scores[0].trim()!==String(awayScore)||scores[1].trim()!==String(homeScore)){
    fail(away+'@'+home+': expected inline scores '+awayScore+'-'+homeScore+', got '+JSON.stringify(scores));
  }
  const text=await card.innerText();
  if(text.includes('UPCOMING'))fail(away+'@'+home+': completed card still says UPCOMING');
  if(!text.includes('FINAL SPREAD RESULT'))fail(away+'@'+home+': spread result block missing');
  if(!text.includes(resultText))fail(away+'@'+home+': expected '+resultText);
}

const dashboardResponse=await fetch(base+'/api/dashboard/nfl',{headers:{accept:'application/json'}});
if(!dashboardResponse.ok)fail('Dashboard API failed: '+dashboardResponse.status);
const dashboard=await dashboardResponse.json();
const apiGames=Array.isArray(dashboard.games)?dashboard.games:[];
const now=Date.now();
const overdue=apiGames.filter(game=>{
  const kickoff=new Date(game.kickoffAt).getTime();
  return Number.isFinite(kickoff)&&now-kickoff>=FINAL_EXPECTED_AFTER_MS&&!game.final;
});
if(overdue.length)fail('Production has games >4h past kickoff still not FINAL: '+overdue.map(g=>g.awayTeam+' @ '+g.homeTeam).join('; '));

await page.goto(base,{waitUntil:'networkidle',timeout:60000});
await page.getByRole('button',{name:/Games/}).click();
await page.waitForSelector('.game-card',{timeout:30000});
await page.waitForTimeout(800);

await verifyFinalCard('NE','SEA',10,13,'PUSH');
await verifyFinalCard('SF','LAR',27,7,'SF COVERED');

for(const game of apiGames){
  const away=game.awayCode||game.awayTeam,home=game.homeCode||game.homeTeam;
  const card=await cardFor(away,home);
  const status=(await card.locator('.game-state').innerText()).trim();
  if(game.final){
    if(status!=='FINAL')fail(away+'@'+home+': API says final but UI says '+status);
    const scores=await card.locator('.score').allInnerTexts();
    if(scores.length!==2||scores[0].trim()!==String(game.final.awayScore)||scores[1].trim()!==String(game.final.homeScore)){
      fail(away+'@'+home+': rendered scores do not match API final');
    }
  }else{
    const kickoff=new Date(game.kickoffAt).getTime();
    if(Number.isFinite(kickoff)&&now-kickoff>=FINAL_EXPECTED_AFTER_MS&&status==='UPCOMING')fail(away+'@'+home+': stale UPCOMING card');
  }
}

await page.locator('.bottom-nav [data-tab="picks"]').click();
await page.waitForSelector('.pick-game',{timeout:30000});
const pickText=(await page.locator('.pick-game').first().innerText()).toUpperCase();
for(const required of ['SPREAD','ML','MARKET WIN','ATS','TIER']){
  if(!pickText.includes(required))fail('Production Picks card missing '+required);
}
const insight=page.locator('.pick-game').first().locator('.pick-insight');
await insight.locator('summary').click();
const insightText=(await insight.innerText()).toUpperCase();
for(const required of ['STRATEGY','BRAIN','HISTORY','CONTEXT','OPEN FULL GAME ANALYSIS']){
  if(!insightText.includes(required))fail('Production Picks insight missing '+required);
}

await page.screenshot({path:'production-card-check.png',fullPage:true});
console.log('Rendered production card acceptance passed');
await browser.close();
