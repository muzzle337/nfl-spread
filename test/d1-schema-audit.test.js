import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Repository-only audit: no Wrangler, credentials, Cloudflare or D1 connection.
test('D1 inventory reports existing migrations and runtime-only declarations', () => {
  const output = execFileSync(process.execPath, ['scripts/audit-d1-schema.mjs'], {
    cwd: process.cwd(), encoding: 'utf8'
  });
  const report = JSON.parse(output.split('\nInventory only:')[0]);
  assert.ok(report.migrationFiles.includes('0001_initial.sql'));
  // The audit lists source declarations, not every table declared only in SQL.\n  // Confirm initial migration presence here; its SQL content is outside this report.\n  assert.ok(report.migrationFiles.includes('0001_initial.sql'));
  const missingNames = new Set(report.notInCheckedInMigrations.map(item => `${item.kind}:${item.name}`));
  for (const name of ['TABLE:context_games', 'TABLE:historical_games',
    'TABLE:weekly_pool_picks', 'TABLE:moneyline_snapshots',
    'TABLE:game_signal_snapshots']) {
    assert.ok(missingNames.has(name), `Expected runtime-only declaration ${name}`);
  }
});
