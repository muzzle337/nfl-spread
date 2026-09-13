import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = readFileSync(new URL('../docs/game-detail-fixture.html', import.meta.url), 'utf8');

test('game detail fixture puts live situation and opportunity above supporting evidence', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.setContent(fixture, { waitUntil: 'load' });

  const detail = page.locator('[data-game-detail-fixture="NO-DET"]');
  await expect(detail).toBeVisible();
  await expect(page.getByText('LIVE', { exact: true })).toBeVisible();
  await expect(page.getByText('Q3 · 8:42', { exact: true })).toBeVisible();
  await expect(detail).toContainText('17');
  await expect(detail).toContainText('14');
  await expect(detail).toContainText('NO +4');
  await expect(detail).toContainText('NO +7.5');
  await expect(detail).toContainText('NO +240');
  await expect(page.getByText('OUR ORIGINAL THESIS', { exact: true })).toBeVisible();
  await expect(page.getByText('NO +4 · A Tier · 72%', { exact: true })).toBeVisible();
  await expect(page.getByText('LIVE OPPORTUNITY', { exact: true })).toBeVisible();
  await expect(page.getByText('+3.5 pts better than pregame', { exact: true })).toBeVisible();
  await expect(page.getByText('WHY WE CARED', { exact: true })).toBeVisible();

  const opportunityBox = await page.getByText('LIVE OPPORTUNITY', { exact: true }).boundingBox();
  expect(opportunityBox).not.toBeNull();
  expect(opportunityBox.y).toBeLessThan(650);

  await expect(page.getByText('Sportsbooks', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/game-detail-fixture.png', fullPage: true });
});
