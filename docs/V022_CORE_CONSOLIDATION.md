# v0.22 Core Consolidation — Shadow Architecture

Status: **shadow only; production remains v0.21**.

## Why this exists

The current runtime is a wrapper chain (v0.14 → … → v0.21). Several generations of injected UI scripts still execute, even when newer UI hides their cards. That creates overlapping requests, recurring refreshes, hard-to-audit D1 behavior, and cache invalidation races.

Observed active overlap includes:

- v0.17 Game Outlook/Picks UI loads `/api/pool/outlooks` and historically had recurring refresh behavior.
- v0.19 Complete Game Detail separately loads pool outlooks and history matchups.
- v0.20 Focus separately loads focus opportunities.
- v0.21 separately loads pool outlooks, history, focus, and freshness.
- v0.18 invalidates the weekly outlook cache after scheduled execution regardless of whether relevant inputs changed.
- schema creation still occurs in normal request paths for several later tables.

## Target runtime

One production Worker entry, one frontend runtime, one canonical weekly read model.

External sources → ingestion/build jobs → D1 transactional source of truth → weekly intelligence builder → generated weekly artifact → Worker/CDN cache → phone UI.

R2 is the planned generated/static artifact store after parity is proven. KV, Durable Objects and Queues are deliberately not part of the first consolidation.

## Canonical weekly payload

`weekly-intelligence/v1` contains the football intelligence required by Dashboard, Games, Game Detail and Focus:

- matchup identity and kickoff
- market / moneyline
- current/open spread summary
- line movement
- current-season projection
- historical summary/context
- matchup context
- Opportunity / Edge / Focus
- final result
- source freshness metadata

Personal weekly picks and Survivor entry state remain separate, small D1 transactional reads/writes.

## Non-negotiable football invariants

- Current-season data exclusively drives the primary spread engine.
- History/context remain supporting evidence and never silently change the current-season cover percentage.
- Negative spread = favorite; positive spread = underdog.
- Spread winner is distinct from outright winner.
- Pushes remain separate from W/L denominator.
- Pick'em remains separate.
- Focus threshold remains >=55% for the current-season spread engine.
- Grade A >=70%, B 60–69.9%, C 55–59.9%.
- Actual current-season percentage is displayed; sample size warns but does not discount the percentage.
- Line history is preserved.
- Regression fixture remains: KC -10 vs LV +10, KC 27–20 => underdog covers.

## Read-safety contract

Normal user navigation must never run historical/raw analytical SQL.

Target post-R2 budget:

| Action | Intelligence D1 rows |
| --- | ---: |
| Initial Dashboard weekly artifact | 0 |
| Dashboard → Games | 0 |
| Open one game | 0 |
| Open all games | 0 |
| Return to Dashboard | 0 |
| Focus navigation | 0 |

Small personal-state operations are allowed and separately budgeted.

## Rebuild contract

Rebuild weekly intelligence only when relevant source data actually changes:

- spread/moneyline change: rebuild
- final score change: rebuild
- material context update: rebuild
- historical/discovery rebuild: rebuild
- app open/navigation: no rebuild
- pick change: no rebuild
- Survivor pick change: no rebuild
- scheduled job with unchanged data: no rebuild

A failed build must never replace the last known-good weekly artifact.

## Migration phases

1. **Shadow payload** — build canonical payload without changing `wrangler.jsonc` or production behavior.
2. **Parity gate** — compare canonical payload with legacy weekly outlook for every game and all primary market/spread/final fields.
3. **Query-budget instrumentation** — count D1 statements/rows in test harness; normal game navigation must require no new intelligence reads.
4. **Schema migrations** — move request-time `CREATE TABLE IF NOT EXISTS` work into formal additive migrations.
5. **R2 binding** — user creates one Standard bucket (`nfl-spread-data`); code writes current and last-good weekly artifacts.
6. **Single frontend runtime** — Dashboard/Games/Game Detail/Focus consume the same in-memory weekly payload.
7. **Shadow production comparison** — old and new outputs run side-by-side without user-facing cutover.
8. **Cutover** — change Worker entrypoint only after parity, mobile regression, read-budget and rollback tests pass.
9. **Cleanup** — remove old wrapper imports/UI injectors from runtime only after the new production path is proven stable.

## Explicitly out of scope for this branch

- changing production `wrangler.jsonc`
- creating Cloudflare R2/KV resources
- deleting old wrappers
- destructive D1 migrations
- changing spread prediction math
- adding new situational football datasets

## Rollback

Production remains on v0.21 during this branch. The eventual cutover must retain the previous production commit as an immediate rollback target and preserve all existing D1 data.
