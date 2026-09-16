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

const seasonPulse={
  season:2026,throughWeek:1,gamesConsidered:5,
  buckets:{
    'AwayDog|<=3':{wins:1,losses:2,pushes:0,decisions:3,coverRate:33.3},
    'AwayFav|<=3':{wins:3,losses:2,pushes:0,decisions:5,coverRate:60},
    'HomeDog|<=3':{wins:2,losses:3,pushes:0,decisions:5,coverRate:40},
    'HomeFav|<=3':{wins:2,losses:1,pushes:0,decisions:3,coverRate:66.7},
    'AwayDog|<=7':{wins:1,losses:0,pushes:0,decisions:1,coverRate:100},
    'HomeFav|<=7':{wins:0,losses:1,pushes:0,decisions:1,coverRate:0}
  },
  momentum:{
    'AwayFav|<=3':[{week:1,weekly:{wins:3,losses:2,pushes:0,decisions:5,coverRate:60},cumulative:{wins:3,losses:2,pushes:0,decisions:5,coverRate:60}}],
    'HomeFav|<=3':[{week:1,weekly:{wins:2,losses:1,pushes:0,decisions:3,coverRate:66.7},cumulative:{wins:2,losses:1,pushes:0,decisions:3,coverRate:66.7}}]
  }
};

function dashboard(week){
  const games=week===2?[projectedGame({
    id:'g3',week:2,awayTeam:'Denver Broncos',homeTeam:'Kansas City Chiefs',kickoffAt:'2026-09-20T20:25:00Z',
    medianAwaySpread:2,medianHomeSpread:-2,classification:{away:'AwayDog',home:'HomeFav',tier:'<=3'},
    moneyline:{consensusAwayMoneyline:110,consensusHomeMoneyline:-125,awayWinProbability:.46,homeWinProbability:.54,books:[]},
    projectedTeam:'Kansas City Chiefs',projectedClassification:'HomeFav',projectedCoverRate:66.7,sampleSize:3,grade:'B',
    currentSeasonStats:{away:{wins:1,losses:2,pushes:0,decisions:3,coverRate:33.3},home:{wins:2,losses:1,pushes:0,decisions:3,coverRate:66.7}}
  })]:[finalGame,projectedGame()];
  return {
    ok:true,season:2026,week,results:{completedGames:week===1?1:0,awaitingCompletion:games.length},
    currentSeasonGamesConsidered:5,seasonPulse,
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
  const currentAway=g.moneyline?.consensusAwayMoneyline??180,currentHome=g.moneyline?.consensusHomeMoneyline??-210;
  return {
    gameId:g.id,awayTeam:g.awayTeam,homeTeam:g.homeTeam,kickoffAt:g.kickoffAt,
    spread:{away:g.medianAwaySpread,home:g.medianHomeSpread,projectedTeam:g.projectedTeam,coverRate:g.projectedCoverRate,grade:g.grade,sampleSize:g.sampleSize,status:g.projectionStatus},
    market:{awayMoneyline:g.moneyline?.consensusAwayMoneyline??180,homeMoneyline:g.moneyline?.consensusHomeMoneyline??-210,awayWinPct:g.moneyline?.awayWinProbability??.34,homeWinPct:g.moneyline?.homeWinProbability??.66},
    movement:{firstCapturedAwaySpread:g.medianAwaySpread+(away?1:-1),currentAwaySpread:g.medianAwaySpread,closingAwaySpread:g.final?g.medianAwaySpread:null,movementMagnitude:1,direction:away?'TOWARD_AWAY':'TOWARD_HOME',marketAlignment:'ALIGNED',moneyline:{
      openingAwayMoneyline:away?-110:100,openingHomeMoneyline:away?-105:-115,
      currentAwayMoneyline:currentAway,currentHomeMoneyline:currentHome,
      closingAwayMoneyline:g.final?currentAway:null,closingHomeMoneyline:g.final?currentHome:null,
      openingAwayNoVigProbability:away?48.8:47,currentAwayNoVigProbability:away?54:46,
      probabilityMagnitude:away?5.2:1,probabilityPointsAway:away?5.2:-1,
      direction:away?'TOWARD_AWAY':'TOWARD_HOME',bookmakerCount:8,changedBookmakers:6,
      towardAwayBookmakers:away?6:1,towardHomeBookmakers:away?0:5
    }},
    history:{
      away:{notable:[{label:'Road games',games:12,winPct:58,coverPct:62}]},home:{notable:[{label:'Home games',games:10,winPct:60,coverPct:55}]},
      evidence:[
        {team:away?g.awayTeam==='Buffalo Bills'?'BUF':g.awayTeam==='Denver Broncos'?'DEN':'SF':g.homeTeam==='Kansas City Chiefs'?'KC':'HOU',subjectLabel:'Team',label:away?'Away Favorite · 0.5–3':'Home Favorite · 0.5–3',games:11,spreadRecord:{covers:7,noCovers:4,pushes:0},coverPct:63.6,timeframe:{fromSeason:2023,toSeason:2025},baseline:{games:130,coverPct:51.2},relationship:'SUPPORTS'},
        {team:away?g.homeTeam==='Houston Texans'?'HOU':'LAR':g.awayTeam==='Denver Broncos'?'DEN':'BUF',subjectLabel:'Coach · Example Coach',label:away?'Home Dog · 0.5–3':'Away Dog · 0.5–3',games:8,spreadRecord:{covers:5,noCovers:3,pushes:0},coverPct:62.5,timeframe:{fromSeason:2022,toSeason:2025},baseline:{games:130,coverPct:48.8},relationship:'CONFLICTS'}
      ],
      evidenceSummary:{supports:1,conflicts:1,neutral:0},
      situational:[
        {team:away?g.awayTeam==='Buffalo Bills'?'BUF':g.awayTeam==='Denver Broncos'?'DEN':'SF':g.homeTeam==='Kansas City Chiefs'?'KC':'HOU',condition:away?'leadingHalftime':'trailingHalftime',label:away?'When leading at halftime':'When trailing at halftime',definition:away?'Team led after the final play of the second quarter.':'Team trailed after the final play of the second quarter.',record:{wins:18,losses:4,ties:0},winPct:81.8,games:22,timeframe:{fromSeason:2023,toSeason:2025},baseline:{games:767,winPct:76.8},relationship:'SUPPORTS',outcomeType:'OUTRIGHT'},
        {team:away?g.homeTeam==='Houston Texans'?'HOU':'LAR':g.awayTeam==='Denver Broncos'?'DEN':'BUF',condition:'oneScoreGame',label:'One-score games',definition:'Final score margin was eight points or fewer.',record:{wins:8,losses:11,ties:0},winPct:42.1,games:19,timeframe:{fromSeason:2023,toSeason:2025},baseline:{games:888,winPct:50},relationship:'CONFLICTS',outcomeType:'OUTRIGHT'}
      ],
      situationalSummary:{supports:1,conflicts:1,neutral:0}
    },
    context:{observations:[{kind:'supporting',label:'Rest edge',detail:'3 additional rest days',side:away?'AWAY':'HOME'}]},
    pick:g.final?g.awayTeam:null,pickResult:g.final?'CORRECT':null,final:g.final
  };
}

function pool(week){
  const games=dashboard(week).games.map(outlookGame);
  const cached=games.find(game=>game.gameId==='g2');
  if(cached)cached.spread.sampleSize=0;
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
    if(url.pathname==='/api/tiers/contributors')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,season:2026,throughWeek:1,classification:url.searchParams.get('classification'),tier:url.searchParams.get('tier'),wins:3,losses:2,pushes:0,decisions:5,coverRate:60,momentum:seasonPulse.momentum['AwayFav|<=3'],games:[
      {id:'c1',week:1,awayTeam:'Buffalo Bills',homeTeam:'Houston Texans',awayScore:24,homeScore:20,awaySpread:-2.5,classification:'AwayFav',tier:'<=3',outcome:'WIN'},
      {id:'c2',week:1,awayTeam:'Miami Dolphins',homeTeam:'New England Patriots',awayScore:17,homeScore:20,awaySpread:-2,classification:'AwayFav',tier:'<=3',outcome:'LOSS'},
      {id:'c3',week:1,awayTeam:'Dallas Cowboys',homeTeam:'New York Giants',awayScore:27,homeScore:20,awaySpread:-3,classification:'AwayFav',tier:'<=3',outcome:'WIN'},
      {id:'c4',week:1,awayTeam:'Philadelphia Eagles',homeTeam:'Washington Commanders',awayScore:24,homeScore:17,awaySpread:-2.5,classification:'AwayFav',tier:'<=3',outcome:'WIN'},
      {id:'c5',week:1,awayTeam:'Las Vegas Raiders',homeTeam:'Denver Broncos',awayScore:17,homeScore:21,awaySpread:-1.5,classification:'AwayFav',tier:'<=3',outcome:'LOSS'}
    ]})});
    if(url.pathname==='/api/admin/session')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,configured:true,authenticated:false})});
    if(url.pathname==='/sw.js')return route.fulfill({status:200,contentType:'application/javascript',body:''});
    return route.fulfill({status:404,contentType:'application/json',body:'{}'});
  });
  await page.goto('http://app.local/');
  await expect(page.getByText('TIER PULSE')).toBeVisible();
});

test('Dashboard connects Tier Pulse to qualified upcoming games and contributors',async({page})=>{
  await expect(page.getByText('QUALIFIED GAMES THIS WEEK')).toBeVisible();
  await expect(page.getByText('Upcoming games in categories currently hitting 55%+')).toBeVisible();
  const focusCard=page.locator('.focus-row').filter({hasText:'BUF @ HOU'});
  await expect(focusCard).toContainText('Away Favorite · 0.5–3');
  await expect(focusCard).toContainText('60%');
  await expect(focusCard).toContainText('3-2 · n=5');
  await expect(focusCard).toContainText('ML -125');
  await expect(focusCard).toContainText('Strategy: Spread');
  await expect(page.locator('.focus-row').filter({hasText:'SF @ LAR'})).toHaveCount(0);
  await page.screenshot({path:'test-results/v022-dashboard.png',fullPage:true});

  await page.locator('[data-bucket="AwayFav|<=3"]').click();
  await expect(page.getByText('Away Favorite · 0.5–3 · Season to date',{exact:true})).toBeVisible();
  await expect(page.getByText('WEEKLY MOMENTUM')).toBeVisible();
  await expect(page.getByText('ALL SEASON CONTRIBUTORS · 5')).toBeVisible();
  await expect(page.locator('.contributor')).toHaveCount(5);
  await expect(page.getByText('3-2 · 60% · n=5')).toBeVisible();
  await expect(page.locator('.game-card')).toHaveCount(1);
  await expect(page.locator('.game-card')).toContainText('BUF');
  await page.screenshot({path:'test-results/v022-tier-filter.png',fullPage:true});
});

test('Week selector loads the known Week 2 schedule before Week 1 is complete',async({page})=>{
  const paid=[];
  page.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/ingest/'))paid.push(request.url())});
  await page.locator('[data-week-select]').selectOption('2');
  await expect(page.locator('[data-week-select]')).toHaveValue('2');
  await expect(page.getByText('DEN @ KC')).toBeVisible();
  await expect(page.getByText('Home Favorite · 0.5–3')).toBeVisible();
  await expect(page.locator('[data-bucket="AwayFav|<=3"]')).toContainText('3-2 season');
  await page.getByRole('button',{name:/Games/}).click();
  await expect(page.locator('.game-card')).toHaveCount(1);
  await expect(page).toHaveURL(/week=2/);
  expect(paid).toEqual([]);
  await page.screenshot({path:'test-results/v022-week2.png',fullPage:true});
});

test('Games shows spreads, moneylines, category, tier and tracked movement',async({page})=>{
  await page.getByRole('button',{name:/Games/}).click();
  const upcoming=page.locator('.game-card').filter({hasText:'BUF'}).filter({hasText:'HOU'});
  await expect(upcoming).toContainText('-2.5 · ML -125');
  await expect(upcoming).toContainText('+2.5 · ML +110');
  await expect(upcoming).toContainText('Away Favorite / Home Dog');
  await expect(upcoming).toContainText('QUALIFIED B · BUF');
  await expect(upcoming).toContainText('Away Favorite · 60% · 3-2 · n=5');
  await expect(upcoming).toContainText('Open BUF -1.5 → Current BUF -2.5');
  await expect(upcoming).toContainText('ML Open BUF -110 → Current -125');
  await expect(upcoming).toContainText('BUF +5.2 probability pts · 6/8 books');
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
  const matchup=page.locator('.pick-game').filter({hasText:'DEN @ KC'});
  await expect(matchup).toContainText('Away Dog / Home Favorite · Tier 0.5–3');
  await expect(matchup).toContainText('Spread +2 · ML +110');
  await expect(matchup).toContainText('Market win 46%');
  await expect(matchup).toContainText('Away Dog ATS · 33.3% · 1-2');
  await expect(matchup).toContainText('Home Favorite ATS · 66.7% · 2-1');
  await expect(matchup).toContainText('Open DEN +1 → Current DEN +2');
  await expect(matchup).toContainText('ML Open DEN +100 → Current +110');
  await expect(matchup).toContainText('KC +1 probability pt · 5/8 books');
  await matchup.locator('.pick-insight summary').click();
  await expect(matchup).toContainText('Strategy');
  await expect(matchup).toContainText('Brain');
  await expect(matchup).toContainText('History');
  await expect(matchup).toContainText('1 supporting · 1 conflicting');
  await expect(matchup).toContainText('Situational 1 supporting · 1 conflicting');
  await expect(matchup).toContainText('Context');
  await expect(matchup.getByText('Open full game analysis ›')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>({scrollX,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}))).toEqual({scrollX:0,overflow:0});
  await page.screenshot({path:'test-results/v022-picks.png',fullPage:true});
});

test('Game Detail explains market, thesis, Brain, history and context',async({page})=>{
  await page.getByRole('button',{name:/Games/}).click();
  await page.locator('.game-card').filter({hasText:'BUF'}).filter({hasText:'HOU'}).click();
  await expect(page.getByText('CURRENT MARKET')).toBeVisible();
  await expect(page.getByText('MARKET MOVEMENT')).toBeVisible();
  await expect(page.getByText('Aligned',{exact:true})).toBeVisible();
  await expect(page.getByText('Spread and moneyline both strengthened toward BUF')).toBeVisible();
  await expect(page.getByText('ML Open BUF -110 / HOU -105 → Current BUF -125 / HOU +110')).toBeVisible();
  await expect(page.getByText('ORIGINAL THESIS')).toBeVisible();
  await expect(page.getByText('EXPERT READ')).toBeVisible();
  await expect(page.getByText('Brain',{exact:true})).toBeVisible();
  await expect(page.getByText('HISTORICAL EVIDENCE')).toBeVisible();
  await expect(page.getByText('Supports BUF · BUF · Team')).toBeVisible();
  await expect(page.getByText('Away Favorite · 0.5–3 · 7-4 ATS · 63.6% · n=11 · 2023–2025')).toBeVisible();
  await expect(page.getByText('NFL baseline 51.2%')).toBeVisible();
  await expect(page.getByText('SITUATIONAL TRENDS')).toBeVisible();
  await expect(page.getByText('When leading at halftime · 18-4 outright · 81.8% · n=22 · 2023–2025')).toBeVisible();
  await expect(page.getByText('NFL baseline 76.8% · Team led after the final play of the second quarter.')).toBeVisible();
  await expect(page.locator('.evidence-item').filter({hasText:'Supports BUF · Rest edge'})).toBeVisible();
  const details=page.locator('.books details');
  await expect(details).not.toHaveAttribute('open','');
  await page.screenshot({path:'test-results/v022-game-detail.png',fullPage:true});
});

test('Tools makes free schedule and selected-week paid actions explicit',async({page})=>{
  await page.locator('.bottom-nav [data-tab="tools"]').click();
  await expect(page.getByText('Load 2026 Season Schedule')).toBeVisible();
  await expect(page.getByText('FREE · stores Weeks 1–18 without using Odds API credits')).toBeVisible();
  await expect(page.getByText('Load Week 1 Lines')).toBeVisible();
  await expect(page.getByText('PAID · one targeted spreads + moneylines request')).toBeVisible();
  await page.screenshot({path:'test-results/v022-tools.png',fullPage:true});
});
