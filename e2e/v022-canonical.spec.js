import { test, expect } from '@playwright/test';
import { canonicalAppPage } from '../src/v022-ui.js';

const dashboard={
  ok:true,
  season:2026,
  week:1,
  results:{completedGames:1,awaitingCompletion:1},
  liveWeekStats:{
    gamesConsidered:1,
    buckets:{
      'AwayDog|<=3':{wins:1,losses:0,pushes:0,coverRate:100},
      'HomeFav|<=3':{wins:0,losses:1,pushes:0,coverRate:0}
    }
  },
  games:[
    {
      id:'g1',week:1,awayTeam:'San Francisco 49ers',homeTeam:'Los Angeles Rams',
      kickoffAt:'2026-09-11T00:20:00Z',medianAwaySpread:3.5,medianHomeSpread:-3.5,
      bookmakerCount:9,classification:{away:'AwayDog',home:'HomeFav',tier:'<=7'},
      projectionStatus:'READY',projectedTeam:'San Francisco 49ers',projectedCoverRate:100,sampleSize:1,grade:'A',
      final:{awayScore:27,homeScore:7},
      postgame:{spreadResult:'COVER',coveringTeam:'San Francisco 49ers',liveBucket:{wins:1,losses:0,pushes:0,coverRate:100}},
      books:[{source:'draftkings',awaySpread:3.5}]
    },
    {
      id:'g2',week:1,awayTeam:'Buffalo Bills',homeTeam:'Houston Texans',
      kickoffAt:'2026-09-15T17:00:00Z',medianAwaySpread:-2.5,medianHomeSpread:2.5,
      bookmakerCount:8,classification:{away:'AwayFav',home:'HomeDog',tier:'<=3'},
      projectionStatus:'READY',projectedTeam:'Buffalo Bills',projectedCoverRate:60,sampleSize:5,grade:'B',
      final:null,live:null,books:[]
    }
  ]
};

const focus={
  ok:true,season:2026,week:1,
  games:[
    {gameId:'g1',awayTeam:'San Francisco 49ers',homeTeam:'Los Angeles Rams',focus:true,spread:{projectedTeam:'San Francisco 49ers',coverRate:100,grade:'A',sampleSize:1},classification:{tier:'<=7'}}
  ]
};

function pool(week){
  if(week===2)return {
    ok:true,season:2026,week:2,summary:{correct:1,wrong:0,pending:0},
    games:[{
      gameId:'g3',awayTeam:'Denver Broncos',homeTeam:'Kansas City Chiefs',
      kickoffAt:'2026-09-20T20:25:00Z',
      market:{awayMoneyline:180,homeMoneyline:-210,awayWinPct:.34,homeWinPct:.66},
      pick:null,pickResult:null,final:null
    }]
  };
  return {
    ok:true,season:2026,week:1,summary:{correct:1,wrong:0,pending:0},
    games:[{
      gameId:'g1',awayTeam:'San Francisco 49ers',homeTeam:'Los Angeles Rams',
      kickoffAt:'2026-09-11T00:20:00Z',
      market:{awayMoneyline:155,homeMoneyline:-175,awayWinPct:.39,homeWinPct:.61},
      pick:'San Francisco 49ers',pickResult:'CORRECT',final:{awayScore:27,homeScore:7}
    }]
  };
}

test.beforeEach(async({page})=>{
  await page.route('http://app.local/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/')return route.fulfill({status:200,contentType:'text/html',body:canonicalAppPage()});
    if(url.pathname==='/api/dashboard/nfl')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(dashboard)});
    if(url.pathname==='/api/focus/opportunities')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(focus)});
    if(url.pathname==='/api/data/freshness')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,state:'CURRENT'})});
    if(url.pathname==='/api/pool/outlooks'){
      const week=Number(url.searchParams.get('week')||1);
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(pool(week))});
    }
    if(url.pathname==='/api/admin/session')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,configured:true,authenticated:false})});
    if(url.pathname==='/sw.js')return route.fulfill({status:200,contentType:'application/javascript',body:''});
    return route.fulfill({status:404,contentType:'application/json',body:'{}'});
  });
  await page.goto('http://app.local/');
  await expect(page.getByText('TIER PULSE')).toBeVisible();
});

test('Dashboard is a command center without the duplicated slate',async({page})=>{
  await expect(page.getByText('TOP OPPORTUNITIES')).toBeVisible();
  await expect(page.getByText('YOUR PICKS')).toBeVisible();
  await expect(page.locator('.pulse-cell.hot')).toHaveCount(1);
  await expect(page.locator('.game-card')).toHaveCount(0);
  await expect(page.getByText('Survivor')).toHaveCount(0);
});

test('Games owns the full slate and final result hierarchy',async({page})=>{
  await page.getByRole('button',{name:/Games/}).click();
  await expect(page.locator('.game-card')).toHaveCount(2);
  const final=page.locator('.game-card').filter({hasText:'SF'}).filter({hasText:'LAR'});
  await expect(final).toContainText('FINAL');
  await expect(final).toContainText('27');
  await expect(final).toContainText('SF COVERED');
  await expect(final).not.toContainText('UPCOMING');
});

test('Picks keeps completed history and advances by explicit week control',async({page})=>{
  await page.locator('.bottom-nav [data-tab="picks"]').click();
  await expect(page.getByText('WEEK 1 · FINAL')).toBeVisible();
  await expect(page.getByText('CORRECT')).toBeVisible();
  await page.locator('[data-week="1"]').click();
  await expect(page.locator('.week-nav strong')).toHaveText('WEEK 2');
  await expect(page.getByText('DEN')).toBeVisible();
  await expect(page.getByText('KC')).toBeVisible();
});

test('Game Detail emphasizes the final spread result and collapses books',async({page})=>{
  await page.getByRole('button',{name:/Games/}).click();
  await page.locator('.game-card').filter({hasText:'SF'}).filter({hasText:'LAR'}).click();
  await expect(page.getByText('SPREAD RESULT')).toBeVisible();
  await expect(page.getByText('SF COVERED')).toBeVisible();
  await expect(page.getByText('ORIGINAL THESIS')).toBeVisible();
  const details=page.locator('.books details');
  await expect(details).not.toHaveAttribute('open','');
});
