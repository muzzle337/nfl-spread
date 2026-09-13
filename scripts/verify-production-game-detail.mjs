import { chromium } from 'playwright';

const base = process.env.PROD_URL || 'https://nfl-spread-api.sanro4.workers.dev';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

try {
  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
  const cards = page.locator('.game-card');
  await cards.first().waitFor({ state: 'visible', timeout: 30000 });

  let target = cards.filter({ hasText: 'BUF' }).filter({ hasText: 'HOU' });
  if (await target.count() === 0) target = cards.first();
  await target.first().click();

  const canonical = page.locator('[data-canonical-game-detail]');
  await canonical.waitFor({ state: 'visible', timeout: 30000 });

  const body = await page.locator('.detail').innerText();
  const required = ['OUR THESIS', 'CURRENT SPREAD', 'CURRENT ML', 'OUR ORIGINAL THESIS', 'WHY WE CARED', 'Line history', 'Sportsbooks', 'Historical evidence', 'Context'];
  const missing = required.filter((text) => !body.includes(text));
  if (missing.length) throw new Error(`Missing canonical detail content: ${missing.join(', ')}`);

  const forbidden = ['KEY INFO', 'PROJECTED · CURRENT SEASON', 'GAME OUTLOOK'];
  const presentForbidden = forbidden.filter((text) => body.includes(text));
  if (presentForbidden.length) throw new Error(`Legacy detail content still visible: ${presentForbidden.join(', ')}`);

  const title = await page.locator('.detail-title').innerText();
  if (!/@/.test(title)) throw new Error(`Unexpected detail title: ${title}`);

  const box = await canonical.boundingBox();
  if (!box || box.y > 220) throw new Error(`Canonical detail starts too low: ${box?.y}`);

  await page.screenshot({ path: 'production-game-detail-check.png', fullPage: true });
  console.log('Rendered production Game Detail acceptance passed:', title.replace(/\n/g, ' · '));
} finally {
  await browser.close();
}
