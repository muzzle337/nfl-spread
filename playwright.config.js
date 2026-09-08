import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    ...devices['iPhone 13'],
    browserName: 'chromium',
    headless: true
  },
  reporter: [['list']]
});
