# D1 migration inventory and safe next steps

Audit date: 2026-09-28. This is a **repository-only inventory**, not a production D1 schema export.

## Verified checked-in migration
- `migrations/0001_initial.sql` creates `games`, `line_snapshots`, `api_usage`, and `settings` plus indexes and initial settings.
- The app has since gained additional runtime-created schema, so `0001_initial.sql` is **not** a complete fresh-environment bootstrap.

## Confirmed runtime schema creators
- `src/context-schema.js` / `ensureContextSchema`: `context_games`, `context_team_metrics`, `context_weather`, `context_sync_runs`, `context_sync_diagnostics`.
- `src/history-schema.js` / `ensureHistorySchema`: `historical_games`, `historical_import_runs`, `historical_coach_summaries`, `historical_evidence_summaries`, `situational_history_cache`, `weekly_outlook_cache`.
- `src/market-schema.js` / `ensureMarketSchema`: `moneyline_snapshots`.

This list is deliberately **not claimed exhaustive**. Inspect all remaining `CREATE TABLE`, `ALTER TABLE`, and index statements in source before writing ordered migrations, including the canonical entrypoint and weekly-picks/signal code.

## Migration implementation acceptance criteria
1. Export the production D1 schema (and take an authorized backup) before any production schema change. Compare it to runtime creators and existing migration history; identify divergent column/index definitions.
2. Write ordered, additive migrations for the *actual* current schema. Do not modify `0001_initial.sql` retroactively if it has been applied. Preserve dormant Survivor tables/data until retention is approved.
3. Provision an isolated, empty **staging** D1 database; apply migrations in order and verify table/index/column presence. Confirm the staging Worker does not use production D1 or production paid-API credentials.
4. Run application unit and mobile-browser tests against the migrated environment, then compare key read-model responses with the existing application. Include Picks save/read and immutable pregame snapshots.
5. Review any runtime schema-creation removal only after the migration path is proven. Do not apply unverified migration files to production.
6. Record the exact production/staging schema versions and a rollback/backup plan in the release PR.

## Release rule
This inventory is documentation only. No production D1 migration, table drop, or Worker deployment is authorized by this document.
