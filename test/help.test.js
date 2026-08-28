import test from "node:test";
import assert from "node:assert/strict";
import { withHelpGuide } from "../src/help.js";

test("help guide adds a question-mark control and concise explanation", () => {
  const html = withHelpGuide("<!doctype html><html><head></head><body><main>App</main></body></html>");

  assert.match(html, /aria-label="How this tool works"/);
  assert.match(html, /How This Tool Works/);
  assert.match(html, /Collect the market/);
  assert.match(html, /Create one consensus line/);
  assert.match(html, /Learn from 2026 results/);
  assert.match(html, /55% or better/);
  assert.match(html, /does not predict the final score/);
});

test("help guide explains grades, locked tiers, and admin tools without exposing a secret", () => {
  const html = withHelpGuide("<html><head></head><body></body></html>");

  assert.match(html, /70%\+/);
  assert.match(html, /60–69%/);
  assert.match(html, /55–59%/);
  assert.match(html, /0\.5–3/);
  assert.match(html, /3\.5–7/);
  assert.match(html, /7\.5\+/);
  assert.match(html, /Update Lines/);
  assert.match(html, /Check Finals/);
  assert.match(html, /Results Integrity/);
  assert.match(html, /API Usage/);
  assert.doesNotMatch(html, /INGEST_ADMIN_TOKEN/);
});
