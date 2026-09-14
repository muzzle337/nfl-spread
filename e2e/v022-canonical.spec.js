import { test, expect } from '@playwright/test';
import { canonicalAppPage } from '../src/v022-ui.js';

function projectedGame(overrides={}){
  return {
    id:'g2',week:1,awayTeam:'Buffalo Bills',homeTeam:'Houston Texans',
    kickoffAt:'2026-09-15T17:00:00Z',status:'SCHEDULED',
    medianAwaySpread:-2.5,medianHomeSpread:2.5,bookmakerCount:8,
    books:[{source:'draftkings',awaySpread:-2.5}],
    moneyline:{
      consensusAwayMoneyline:-125,consensusHomeMoneyline:110,
      awayWinProbability:.54,homeWinProbability:.46,
      books:[{source:'draftkings',awayMoneyline:-125,homeMoneyline:110}]
    },
    classification:{away:'AwayFav',home:'HomeDog',tier:'<=3'},
    currentSeasonStats:{
      away:{wins:3,losses:2,pushes:0,decisions:5,coverRate:60},
      home:{wins:2,losses:3,pushes:0,decisions:5,coverRate:40}
    },
    projectionStatus:'READY',projectedTeam:'Buffalo Bills',projectedClassification:'AwayFav',
    projectedCoverRate:60,sampleSize:5,grade:'B',final:null,live:null,
    ...overrides
  };
}

const finalGame=projectedGame({
  id:'g1',awayTeam:'San Francisco 49ers',homeTeam:'Los Angeles Rams',
  kickoffAt:'2026-09-11T00:20:00Z',medianAwaySpread:3.5,medianHomeSpread:-3.5,
  classification:{away:'AwayDog',home:'HomeFav',tier:'<=7'},
  currentSeasonStats:{away:{wins:1,losses:0,pushes:0,decisions:1,coverRate:100},home:{wins:0,losses:1,pushes:0,decisions:1,coverRate:0}},
  projectedTeam:'San Francisco 49ers',projectedClassification:'AwayDog',projectedCoverRate:100,sampleSize:1,grade:'A',
  final:{awayScore:27,homeScore:7},
  postgame:{spreadResult:'COVER',coveringTeam:'San Francisco 49ers',liveBucket:{wins:1,losses:0,pushes:0,coverRate:100}}
});

function dashboard(week){
  const games=week===2?[projectedGame({
    id:'g3',week:2,awayTeam:'Denver Broncos',homeTeam:'Kansas City Chiefs',kickoffAt:'2026-09-20T20:25:00Z',
    medianAwaySpread:2,medianHomeSpread:-2,classification:{away:'AwayDog',home:'HomeFav',tier:'<=3'},
    projectedTeam:'Kansas City Chiefs',projectedClassification:'HomeFav',projectedCoverRate:66.7,sampleSize:3,grade:'B',
    currentSeasonStats:{away:{wins:1,losses:2,pushes:0,decisions:3,coverRate:33.3},home:{wins:2,losses:1,pushes:0,decisions:3,coverRate:66.7}}
  })]:[finalGame,projectedGame()];
  return {
    ok:true,season:2026,week,results:{completedGames:week===1?1:0,awaitingCompletion:games.length},
    currentSeasonGamesConsidered:5,
    liveWeekStats:{gamesConsidered:5,buckets:{
      'AwayDog|<=3':{wins:1,losses:2,pushes:0,coverRate:33.3},
      'AwayFav|<=3':{wins:3,losses:2,pushes:0,coverRate:60},
      'HomeDog|<=3':{wins:2,losses:3,pushes:0,coverRate:40},
      'HomeFav|<=3':{wins:2,losses:1,pushes:0,coverRate:66.7},
      'AwayDog|<=7':{wins:1,losses:0,pushes:0,coverRate:100},
      'HomeFav|<=7':{wins:0,losses:1,pushes:0,coverRate:0}
    }},games
  };
}

function outlookGame(g){
  const away=g.projectedTeam===g.awayTeam;
  return {
    gameId:g.id,awayTeam:g.awayTeam,homeTeam:g.homeTeam,kickoffAt:g.kickoffAt,
    spread:{away:g.medianAwaySpread,home:g.medianHomeSpread,projectedTeam:g.projectedTeam,coverRate:g.projectedCoverRate,grade:g.grade,sampleSize:g.sampleSize,status:g.projectionStatus},
    market:{awayMoneyline:g.moneyline?.consensusAwayMoneyline??180,homeMoneyline:g.moneyline?.consensusHomeMoneyline??-210,awayWinPct:g.moneyline?.awayWinProbability??.34,homeWinPct:g.moneyline?.homeWinProbability??.66},
    movement:{firstCapturedAwaySpread:g.medianAwaySpread+(away?1:-1),currentAwaySpread:g.medianAwaySpread,closingAwaySpread:g.final?g.medianAwaySpread:null,movementMagnitude:1,direction:away?'TOWARD_AWAY':'TOWARD_HOME'},
    history:{away:{notable:[{label:'Road games',games:12,winPct:58,coverPct:62}]},home:{notable:[{label:'Home games',games:10,winPct:60,coverPct:55}]}},
    context:{observations:[{kind:'supporting',label:'Rest edge',detail:'3 additional rest days',side:away?'AWAY':'HOME'}]},
    pick:g.final?g.awayTeam:null,pickResult:g.final?'CORRECT':null,final:g.final
  };
}

function pool(week){
  const games=dashboard(week).games.map(outlookGame);
  return {ok:true,season:2026,week,summary:{correct:week===1?1:0,wrong:0,pending:games.length-(week===1?1:0)},games};
}

function focus(week){
  return {ok:true,season:2026,week,games:dashboard(week).games.map(g=>({
    gameId:g.id,awayTeam:g.awayTeam,homeTeam:g.homeTeam,focus:g.grade?'HIGH':'LOW',
    bestUse:g.grade?'SPREAD':'WATCH',independentSignals:g.grade?2:0,
    edge:g.grade?[{domain:'Current season',detail:'Tier qualifies'}]:[],conflict:[]
  }))};
}

test.beforeEach(async({page})=>{
  await page.route('http://app.local/**',async route=>{
    const url=new URL(route.request().url());
    const week=Number(url.searchParams.get('week')||1);
    if(url.pathname==='/')return route.fulfill({status:200,contentType:'text/html',body:canonicalAppPage()});
    if(url.pathname==='/api/dashboard/nfl')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard(week))});
    if(url.pathname==='/api/focus/opportunities')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(focus(week))});
    if(url.pathname==='/api/data/freshness')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,state:'CURRENT'})});
    if(url.pathname==='/api/pool/outlooks')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(pool(week))});
    if(url.pathname==='/api/admin/session')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,configured:true,authenticated:false})});
    if(url.pathname==='/sw.js')return route.fulfill({status:200,contentType:'application/javascript',body:''});
    return route.fulfill({status:404,contentType:'application/json',body:'{}'});
  });
  await page.goto('http://app.local/');
  await expect(page.getByText('TIER PULSE')).toBeVisible();
});

test('Dashboard connects Tier Pulse to qualified upcoming Focus games',async({page})=>{
  await expect(page.getByText('FOCUS THIS WEEK')).toBeVisible();
  const focusCard=page.locator('.focus-row').filter({hasText:'BUF @ HOU'});
  await expect(focusCard).toContainText('Away Favorite · 0.5–3');
  await expect(focusCard).toContainText('60%');
  await expect(focusCard).toContainText('3-2 · n=5');
  await expect(focusCard).toContainText('ML -125');
  await expect(focusCard).toContainText('Strategy: Spread');
  await expect(page.locator('.focus-row').filter({hasText:'SF @ LAR'})).toHaveCount(0);
  await page.screenshot({path:'test-results/v022-dashboard.png',fullPage:true});

  await page.locator('[data-bucket="AwayFav|<=3"]').click();
  await expect(page.getByText('Away Favorite · 0.5–3',{exact:true})).toBeVisible();
  await expect(page.locator('.game-card')).toHaveCount(1);
  await expect(page.locator('.game-card')).toContainText('BUF');
  await page.screenshot({path:'test-results/v022-tier-filter.png',fullPage:true});
});

test('Week selector loads the known Week 2 schedule before Week 1 is complete',async({page})=>{
  await page.locator('[data-week-select]').selectOption('2');
  await expect(page.locator('[data-week-select]')).toHaveValue('2');
  await expect(page.getByText('DEN @ KC')).toBeVisible();
  await expect(page.getByText('Home Favorite · 0.5–3')).toBeVisible();
  await page.getByRole('button',{name:/Games/}).click();
  await expect(page.locator('.game-card')).toHaveCount(1);
  await expect(page).toHaveURL(/week=2/);
  await page.screenshot({path:'test-results/v022-week2.png',fullPage:true});
});

test('Games shows spreads, moneylines, category, tier and tracked movement',async({page})=>{
  await page.getByRole('button',{name:/Games/}).click();
  const upcoming=page.locator('.game-card').filter({hasText:'BUF'}).filter({hasText:'HOU'});
  await expect(upcoming).toContainText('-2.5 · ML -125');
  await expect(upcoming).toContainText('+2.5 · ML +110');
  await expect(upcoming).toContainText('Away Favorite / Home Dog');
  await expect(upcoming).toContainText('Open BUF -1.5 → Current BUF -2.5');
  const final=page.locator('.game-card').filter({hasText:'SF'}).filter({hasText:'LAR'});
  await expect(final).toContainText('FINAL');
  await expect(final).toContainText('SF COVERED');
  await page.screenshot({path:'test-results/v022-games.png',fullPage:true});
});

test('Picks shares the selected week and remains horizontally stable',async({page})=>{
  await page.locator('[data-week-select]').selectOption('2');
  await page.locator('.bottom-nav [data-tab="picks"]').click();
  await expect(page.locator('[data-week-select]')).toHaveValue('2');
  await expect(page.getByText('DEN',{exact:true})).toBeVisible();
  await expect(page.getByText('KC',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>({scrollX,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}))).toEqual({scrollX:0,overflow:0});
  await page.screenshot({path:'test-results/v022-picks.png',fullPage:true});
});

test('Game Detail explains market, thesis, Brain, history and context',async({page})=>{
  await page.getByRole('button',{name:/Games/}).click();
  await page.locator('.game-card').filter({hasText:'BUF'}).filter({hasText:'HOU'}).click();
  await expect(page.getByText('CURRENT MARKET')).toBeVisible();
  await expect(page.getByText('ORIGINAL THESIS')).toBeVisible();
  await expect(page.getByText('EXPERT READ')).toBeVisible();
  await expect(page.getByText('Brain',{exact:true})).toBeVisible();
  await expect(page.getByText('HISTORICAL EVIDENCE')).toBeVisible();
  await expect(page.locator('.evidence-item').filter({hasText:'Supports BUF · Rest edge'})).toBeVisible();
  const details=page.locator('.books details');
  await expect(details).not.toHaveAttribute('open','');
  await page.screenshot({path:'test-results/v022-game-detail.png',fullPage:true});
});
