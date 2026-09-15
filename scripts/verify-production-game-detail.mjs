import { chromium } from 'playwright';

const base=process.env.PROD_URL||'https://nfl-spread-api.sanro4.workers.dev';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});

try{
  await page.goto(base,{waitUntil:'networkidle',timeout:60000});
  await page.getByRole('button',{name:/Games/}).click();
  const cards=page.locator('.game-card');
  await cards.first().waitFor({state:'visible',timeout:30000});

  let target=cards.filter({hasText:'BUF'}).filter({hasText:'HOU'});
  if(await target.count()===0)target=cards.filter({hasText:'FINAL'}).first();
  await target.first().click();

  const detail=page.locator('.detail-head');
  await detail.waitFor({state:'visible',timeout:30000});
  const body=(await page.locator('#app').innerText()).toUpperCase();
  const required=['FINAL','SPREAD RESULT','ORIGINAL THESIS','EXPERT READ','HISTORICAL EVIDENCE','SPORTSBOOKS'];
  const missing=required.filter(value=>!body.includes(value));
  if(missing.length)throw new Error('Missing canonical detail content: '+missing.join(', '));

  const forbidden=['KEY INFO','PROJECTED · CURRENT SEASON','GAME OUTLOOK'];
  const presentForbidden=forbidden.filter(value=>body.includes(value));
  if(presentForbidden.length)throw new Error('Legacy detail content still visible: '+presentForbidden.join(', '));

  const books=page.locator('.books details');
  if(await books.getAttribute('open')!==null)throw new Error('Sportsbook rows should be collapsed by default');

  const title=await page.locator('.detail-title').innerText();
  if(!/@/.test(title))throw new Error('Unexpected detail title: '+title);

  await page.screenshot({path:'production-game-detail-check.png',fullPage:true});
  console.log('Rendered production Game Detail acceptance passed: '+title.replace(/\n/g,' · '));
}finally{
  await browser.close();
}
