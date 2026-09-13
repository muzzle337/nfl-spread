import { chromium } from '@playwright/test';

const base = process.env.PROD_URL || 'https://nfl-spread-api.sanro4.workers.dev';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const FINAL_EXPECTED_AFTER_MS = 4 * 60 * 60 * 1000;

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

const dashboardResponse = await fetch(`${base}/api/dashboard/nfl`, { headers: { accept: 'application/json' } });
if (!dashboardResponse.ok) fail(`Dashboard API failed: ${dashboardResponse.status}`);
const dashboard = await dashboardResponse.json();
const apiGames = Array.isArray(dashboard.games) ? dashboard.games : [];
const now = Date.now();
const overdue = apiGames.filter((game) => {
  const kickoff = new Date(game.kickoffAt).getTime();
  return Number.isFinite(kickoff) && now - kickoff >= FINAL_EXPECTED_AFTER_MS && !game.final;
});
if (overdue.length) {
  fail(`Production has games >4h past kickoff still not FINAL: ${overdue.map((g) => `${g.awayTeam} @ ${g.homeTeam} (${g.kickoffAt}, status=${g.status ?? 'null'})`).join('; ')}`);
}

await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('.game-card', { timeout: 30000 });
await page.waitForTimeout(1500);

await verifyFinalCard('NE', 'SEA', 10, 13, 'PUSH');
await verifyFinalCard('SF', 'LAR', 27, 7, 'SF COVERED');

for (const game of apiGames) {
  const awayCode = game.awayCode || game.awayTeam;
  const homeCode = game.homeCode || game.homeTeam;
  const card = await cardFor(awayCode, homeCode);
  const status = (await card.locator('.df21-game-status').innerText()).trim();
  if (game.final) {
    if (status !== 'FINAL') fail(`${awayCode}@${homeCode}: API says final but rendered card says ${status}`);
    const scores = await card.locator('.df21-team-score').allInnerTexts();
    if (scores.length !== 2 || scores[0].trim() !== String(game.final.awayScore) || scores[1].trim() !== String(game.final.homeScore)) {
      fail(`${awayCode}@${homeCode}: rendered scores do not match API final ${game.final.awayScore}-${game.final.homeScore}`);
    }
  } else {
    const kickoff = new Date(game.kickoffAt).getTime();
    if (Number.isFinite(kickoff) && now - kickoff >= FINAL_EXPECTED_AFTER_MS && status === 'UPCOMING') {
      fail(`${awayCode}@${homeCode}: what the user sees is stale — game is >4h past kickoff but card still says UPCOMING`);
    }
  }
}

await page.screenshot({ path: 'production-card-check.png', fullPage: true });
console.log('Rendered production card acceptance passed');
await browser.close();
