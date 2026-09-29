import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/v022-entry.js';
import { createAdminSession } from '../src/admin-session.js';

const endpoint = 'https://example.com/api/odds/nfl';
const env = {
  ADMIN_UI_PIN: 'test-pin-only',
  INGEST_ADMIN_TOKEN: 'test-admin-token-only',
  ODDS_API_KEY: 'test-odds-key-only'
};

test('paid odds GET rejects anonymous callers without reaching the provider', async () => {
  const response = await worker.fetch(new Request(endpoint), env);
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /Admin PIN required/);
});

test('paid odds GET rejects invalid admin token before reaching provider', async () => {
  const response = await worker.fetch(new Request(endpoint, {
    headers: { 'x-admin-token': 'invalid' }
  }), env);
  assert.equal(response.status, 401);
});

test('paid odds GET requires configured admin authentication before reaching provider', async () => {
  const response = await worker.fetch(new Request(endpoint), { ODDS_API_KEY: 'test-odds-key-only' });
  assert.equal(response.status, 503);
});

test('authorized paid odds GET reaches the existing handler (no provider call in test)', async () => {
  const response = await worker.fetch(new Request(endpoint, {
    headers: { 'x-admin-token': env.INGEST_ADMIN_TOKEN }
  }), { ...env, ODDS_API_KEY: undefined });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Odds API is not configured/);
});

test('valid admin session cookie reaches the existing handler without provider call', async () => {
  const session = await createAdminSession(env.ADMIN_UI_PIN, env);
  assert.equal(session.ok, true);
  const response = await worker.fetch(new Request(endpoint, {
    headers: { cookie: 'nfl_admin_session=' + session.token }
  }), { ...env, ODDS_API_KEY: undefined });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Odds API is not configured/);
});
