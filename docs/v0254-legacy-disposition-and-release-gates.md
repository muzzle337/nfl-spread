# v0.25.4 legacy PR disposition and release gates

## Verification performed

- PR #40 is a **shadow-only v0.22 prototype** that imports `v021-entry.js` and introduces `src/v022-shadow-entry.js`, a proposed `weekly-intelligence/v1` read model and parity tests. Current production already uses `src/v022-entry.js` with a single canonical `src/v022-ui.js` frontend. **Do not merge PR #40**: its old entrypoint and assumptions would reintroduce obsolete architecture. The pure weekly read-model/parity concept is potentially useful for a future performance project, but is not a v0.25.4 release prerequisite. Preserve its branch as historical reference unless owner approves closing it.
- PR #52 targets v0.21.8 and adds live-score ingestion, manual score diagnostics, finalization verification, cache invalidation and legacy UI changes. The current `src/results.js` already exports `ingestLiveScores`; `src/v022-entry.js` already imports it and performs manual score ingestion, cache invalidation, provider summary, week status and finalization verification. **Do not merge PR #52**: its v021 entrypoint, version changes and old smoke assertions are obsolete. Its original score behavior is represented in the current code. Preserve the old branch until owner approves closing.
- Neither stale PR is evidence that current runtime behavior is correct in all edge cases; current tests and production smoke remain release gates. No old branches were deleted and neither stale PR was merged.

## Confirmed repository-side completion

- v0.25.4 PRs #67–#71 have been merged. Their latest post-merge GitHub Test and Production Smoke Gate checks completed successfully as of this review.
- `scripts/audit-d1-schema.mjs` is a **read-only, source-to-migration inventory aid**, not an actual production schema comparison.
- The paid `GET /api/odds/nfl` route now requires existing admin authentication before any provider request.

## External release blockers: do not guess or bypass

Cloudflare has no connected integration in this workspace. Repository configuration only identifies the production Worker and production D1. A separate staging Worker, isolated D1, preview bindings, secret separation, preview cron policy and production backup **have not been verified**.

An authorized Cloudflare operator must provide:
1. Screenshot or configuration export of the Worker **Settings → Builds/Deployments** showing production branch, preview policy and build command.
2. Screenshot or configuration export of **preview/staging bindings**, showing a staging D1 ID distinct from production ID (redact credentials); confirm no production Odds API key in preview and no scheduled paid calls.
3. A real preview/staging URL and successful read-only `/api/health` check.
4. A production D1 schema export plus backup confirmation, without exposing customer secrets or records.

Only then: compare exported schema to `scripts/audit-d1-schema.mjs` output; prepare ordered additive migrations; apply them first to empty isolated staging D1; test API reads, Picks writes, immutable pregame snapshots and mobile rendered UI. Apply no migration to production without backup, schema parity and explicit release approval.

**Stop boundary:** v0.25.5 Weekly Checkpoints must not begin until staging isolation and migration verification are actually complete. Do not claim that a passing GitHub production smoke test establishes staging isolation.
