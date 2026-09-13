import { chromium } from '@playwright/test';

const base = process.env.PROD_URL || 'https://nfl-spread-api.sanro4.workers.dev';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

function fail(message) {
  throw new Error(message);
}

async function cardFor(away, home) {
  const cards = page.locator('.game-card');
  const count = await cards.count();
  for (let i = 0; i < count; i += 1) {
    const card = cards.nth(i);
    const text = await card.innerText();
    if (text.includes(away) && text.includes(home)) return card;
  }
  fail(`Card ${away} @ ${home} not found`);
}

async function verifyFinalCard(away, home, awayScore, homeScore, resultText) {
  const card = await cardFor(away, home);
  const status = (await card.locator('.df21-game-status').innerText()).trim();
  if (status !== 'FINAL') fail(`${away}@${home}: expected FINAL status, got ${status}`);

  const scores = await card.locator('.df21-team-score').allInnerTexts();
  if (scores.length !== 2 || scores[0].trim() !== String(awayScore) || scores[1].trim() !== String(homeScore)) {
    fail(`${away}@${home}: expected inline scores ${awayScore}-${homeScore}, got ${JSON.stringify(scores)}`);
  }

  const text = await card.innerText();
  if (text.includes('UPCOMING')) fail(`${away}@${home}: completed card still says UPCOMING`);
  if (text.includes(`FINAL · ${away} ${awayScore}`)) fail(`${away}@${home}: duplicate centered FINAL score is still present`);
  if (text.includes('PREGAME TIER EDGE')) fail(`${away}@${home}: completed card still shows PREGAME TIER EDGE`);
  if (!text.includes('FINAL SPREAD RESULT')) fail(`${away}@${home}: postgame spread result block missing`);
  if (!text.includes(resultText)) fail(`${away}@${home}: expected postgame result ${resultText}`);
}

await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('.game-card', { timeout: 30000 });
await page.waitForTimeout(1500);

await verifyFinalCard('NE', 'SEA', 10, 13, 'PUSH');
await verifyFinalCard('SF', 'LAR', 27, 7, 'SF COVERED');

const upcoming = await cardFor('NYJ', 'TEN');
const upcomingStatus = (await upcoming.locator('.df21-game-status').innerText()).trim();
if (upcomingStatus !== 'UPCOMING') fail(`NYJ@TEN: expected UPCOMING, got ${upcomingStatus}`);
if (await upcoming.locator('.df21-team-score').count()) fail('NYJ@TEN: upcoming game should not show final score nodes');

await page.screenshot({ path: 'production-card-check.png', fullPage: true });
console.log('Rendered production card acceptance passed');
await browser.close();
