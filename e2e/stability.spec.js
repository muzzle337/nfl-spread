import { test, expect } from '@playwright/test';
import { dashboardPage } from '../src/dashboard.js';
import { withContextOpportunityUi } from '../src/context-opportunity-ui.js';
import { withHistoryMatchupUi } from '../src/history-matchup-ui.js';
import { withGameOutlookPicksUi } from '../src/game-outlook-picks-ui.js';
import { withPicksPolishUi } from '../src/picks-polish-ui.js';
import { withStabilityUi } from '../src/stability-ui.js';

function finalHtml(){
  let html=dashboardPage();
  html=withContextOpportunityUi(html);
  html=withHistoryMatchupUi(html);
  html=withGameOutlookPicksUi(html);
  html=withPicksPolishUi(html);
  html=withStabilityUi(html);
  return html;
}

const dashboard={
  ok:true,season:2026,week:1,currentSeason:2026,currentWeek:1,
  games:[],focus:[],stats:{},lastUpdatedAt:null
};
const pool={
  ok:true,season:2026,week:1,summary:{correct:0,wrong:0,pending:2,accuracy:null},games:[
    {gameId:'g1',awayTeam:'New England Patriots',homeTeam:'Seattle Seahawks',kickoffAt:'2026-09-10T00:20:00Z',spread:{away:3,home:-3,projectedTeam:null,coverRate:null,grade:null},market:{awayMoneyline:145,homeMoneyline:-165,awayWinPct:.38,homeWinPct:.62},movement:{text:'Line stable'},history:null,context:null,outlook:{level:'LOW INFO',team:'Seattle Seahawks',reason:'Only one directional indicator is currently available.'},pick:null,pickResult:null},
    {gameId:'g2',awayTeam:'Denver Broncos',homeTeam:'Kansas City Chiefs',kickoffAt:'2026-09-15T00:15:00Z',spread:{away:5.5,home:-5.5,projectedTeam:null,coverRate:null,grade:null},market:{awayMoneyline:190,homeMoneyline:-220,awayWinPct:.31,homeWinPct:.69},movement:{text:'Line stable'},history:null,context:null,outlook:{level:'LOW INFO',team:'Kansas City Chiefs',reason:'Only one directional indicator is currently available.'},pick:null,pickResult:null}
  ]
};

test.beforeEach(async ({page})=>{
  await page.route('http://app.local/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/')return route.fulfill({status:200,contentType:'text/html',body:finalHtml()});
    if(url.pathname==='/api/dashboard/nfl')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)});
    if(url.pathname.startsWith('/api/context/opportunities'))return route.fulfill({status:502,contentType:'text/html',body:'upstream broke'});
    if(url.pathname.startsWith('/api/history/matchups'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,games:[]})});
    if(url.pathname==='/api/pool/outlooks')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(pool)});
    if(url.pathname==='/api/pool/picks'&&route.request().method()==='POST'){
      const body=route.request().postDataJSON();
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,pick:{gameId:body.gameId,team:body.team}})});
    }
    return route.fulfill({status:404,contentType:'application/json',body:'{}'});
  });
  await page.goto('http://app.local/');
});

test('Picks stays isolated when Context repeatedly fails JSON parsing',async ({page})=>{
  await expect(page.locator('[data-pool17-nav]')).toBeVisible();
  await page.locator('[data-pool17-nav]').click();
  await expect(page.locator('.pool17-wrap')).toBeVisible();
  await expect(page.locator('.pool17-game')).toHaveCount(2);
  await page.waitForTimeout(6500);
  await expect(page.locator('.ctx14-board')).toHaveCount(0);
  await expect(page.locator('.hist16-board')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-app-view','picks');
  await expect(page.getByText('Invalid JSON response')).toHaveCount(0);
});

test('repeated navigation does not accumulate dashboard watchlists',async ({page})=>{
  await page.waitForTimeout(1200);
  await expect(page.locator('.ctx14-board')).toHaveCount(1);
  await page.locator('[data-pool17-nav]').click();
  await expect(page.locator('.ctx14-board')).toHaveCount(0);
  const dashboardNav=page.locator('.nav-btn').filter({hasText:'Dashboard'});
  await dashboardNav.click();
  await page.waitForTimeout(1200);
  await expect(page.locator('.ctx14-board')).toHaveCount(1);
  await page.waitForTimeout(2500);
  await expect(page.locator('.ctx14-board')).toHaveCount(1);
});
