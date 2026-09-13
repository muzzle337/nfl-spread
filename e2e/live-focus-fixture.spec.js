import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = readFileSync(new URL('../docs/live-focus-fixture.html', import.meta.url), 'utf8');

test('Live Focus fixture shows the decision-critical information above the fold', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(fixture, { waitUntil: 'load' });

  const card = page.locator('[data-live-focus-card="NO-DET"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('LIVE');
  await expect(card).toContainText('Q3 · 8:42');
  await expect(card).toContainText('17');
  await expect(card).toContainText('14');
  await expect(card).toContainText('NO +4');
  await expect(card).toContainText('NO +7.5');
  await expect(card).toContainText('NO +240');
  await expect(card).toContainText('A TIER · 72%');
  await expect(card).toContainText('+3.5 pts better than our pregame number');
  await expect(card).toContainText('WHY WE CARED');

  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  expect(box.y).toBeLessThan(190);

  await page.screenshot({ path: 'test-results/live-focus-fixture.png', fullPage: true });
});
