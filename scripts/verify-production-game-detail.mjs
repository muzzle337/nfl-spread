import { chromium } from 'playwright';

const base=process.env.PROD_URL||'https://nfl-spread-api.sanro4.workers.dev';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});

try{
  await page.goto(base+'/?week=1',{waitUntil:'networkidle',timeout:60000});
  await page.getByRole('button',{name:/Games/}).click();
  const cards=page.locator('.game-card');
  await cards.first().waitFor({state:'visible',timeout:30000});

  let target=cards.filter({hasText:'BUF'}).filter({hasText:'HOU'});
  if(await target.count()===0)target=cards.filter({hasText:'FINAL'}).first();
  await target.first().click();

  const detail=page.locator('.detail-head');
  await detail.waitFor({state:'visible',timeout:30000});
  const body=(await page.locator('#app').innerText()).toUpperCase();
  const required=['FINAL','SPREAD RESULT','MARKET MOVEMENT','ORIGINAL THESIS','EXPERT READ','HISTORICAL EVIDENCE','SITUATIONAL TRENDS','SPORTSBOOKS'];
  const missing=required.filter(value=>!body.includes(value));
  if(missing.length)throw new Error('Missing canonical detail content: '+missing.join(', '));

  const forbidden=['KEY INFO','PROJECTED · CURRENT SEASON','GAME OUTLOOK'];
  const presentForbidden=forbidden.filter(value=>body.includes(value));
  if(presentForbidden.length)throw new Error('Legacy detail content still visible: '+presentForbidden.join(', '));

  const books=page.locator('.books details');
  if(await books.getAttribute('open')!==null)throw new Error('Sportsbook rows should be collapsed by default');

  const title=await page.locator('.detail-title').innerText();
  if(!/@/.test(title))throw new Error('Unexpected detail title: '+title);

  await page.locator('.back').click();
  await page.locator('[data-week-select]').selectOption('2');
  await page.locator('.game-card').first().click();
  const historical=page.locator('.detail-card').filter({hasText:'Historical Evidence'});
  await historical.waitFor({state:'visible',timeout:30000});
  const evidenceItems=historical.locator('.evidence-item');
  const evidenceCount=await evidenceItems.count();
  if(evidenceCount<1||evidenceCount>3)throw new Error('Expected 1-3 historical evidence items, got '+evidenceCount);
  const historicalText=(await historical.innerText()).toUpperCase();
  for(const requiredEvidence of ['ATS','NFL BASELINE']){
    if(!historicalText.includes(requiredEvidence))throw new Error('Historical Evidence missing '+requiredEvidence);
  }

  const situational=page.locator('.detail-card').filter({hasText:'Situational Trends'});
  const situationalItems=situational.locator('.evidence-item');
  const situationalCount=await situationalItems.count();
  if(situationalCount<1||situationalCount>2)throw new Error('Expected 1-2 situational trends, got '+situationalCount);
  const situationalText=(await situational.innerText()).toUpperCase();
  for(const requiredTrend of ['OUTRIGHT','NFL BASELINE','2023–2025']){
    if(!situationalText.includes(requiredTrend))throw new Error('Situational Trends missing '+requiredTrend);
  }

  await page.screenshot({path:'production-game-detail-check.png',fullPage:true});
  console.log('Rendered production Game Detail acceptance passed with '+evidenceCount+' historical evidence items and '+situationalCount+' situational trends');
}finally{
  await browser.close();
}
