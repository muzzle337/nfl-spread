# Release and staging runbook (v0.25.4 foundation audit)

## Verified repository configuration
- Production branch: `main`; Cloudflare Git integration deploys production after merge.
- Production Worker: `nfl-spread-api`, entrypoint `src/v022-entry.js`.
- Checked-in `wrangler.jsonc` declares only production D1 `nfl-spread-db`.
- There is **no dedicated staging Worker or D1 configuration checked into this repository**. Cloudflare branch previews may exist, but their availability and data isolation must be confirmed in the Cloudflare dashboard before relying on them.
- Pull requests to `main` run Node and Chromium browser tests through `.github/workflows/test.yml`.
- Merges to `main` run `.github/workflows/production-smoke.yml`; this checks actual production data and rendered cards/detail.

## Mandatory staging verification (requires Cloudflare dashboard access)
1. Inspect the Worker Git build integration: connected repository, production branch, preview branch policy, build command, and deployment history.
2. Open a fresh PR preview, record the actual preview URL in its PR, and verify its reported version. Do not invent a predictable preview URL.
3. Confirm preview bindings: **do not point a preview that can write or run cron at production D1**. Confirm that paid Odds API requests and scheduled triggers are disabled or isolated in preview. Use separate preview credentials, database and quotas when supported.
4. Test Dashboard, Games, Picks, Tools and Game Detail at the owner's mobile viewport. Save browser screenshots to the PR.
5. If branch previews are absent or unsafe, create a dedicated staging Worker with a separate D1 database and secrets, and document its deployment steps before doing any risky database changes.

## Normal release path
1. Fetch fresh `main` and create one narrow branch per fix/feature.
2. Open a PR; require Node and Playwright checks to complete successfully.
3. Test the **rendered** preview on mobile, verify no horizontal overflow or stale shell, and record preview URL/screenshots.
4. Obtain owner approval. Merge to `main` only after approval.
5. Confirm Cloudflare deployment and `/api/health` version, then require production smoke to pass.
6. Check live rendered Dashboard, Games, Picks, Tools and Game Detail. If an issue appears, stop further releases and follow the documented rollback procedure once Cloudflare deployment settings have been verified.

## Branch and PR housekeeping
- Never delete `main`, an active release branch, or a branch with unique unmerged changes without explicit review.
- Audit obsolete open PRs #40 and #52; compare each with current `main`, then close only after documenting whether any unique work remains.
- Archive a list of old branch names, heads, merge state, and associated PRs before deleting reviewed stale branches.
- Do not reintroduce the pre-v0.22 wrapper architecture or active Survivor runtime.

## Database migration safety
- First export and back up the production D1 schema/data using authorized Cloudflare access.
- Convert runtime-created tables into ordered migrations and verify them against an empty **nonproduction** database.
- Do not execute unreviewed schema changes against production. Keep any legacy Survivor data until retention is separately decided.

## Open external verification
Cloudflare account/build settings, preview isolation, and rollback configuration are not available in repository configuration. Mark these unverified until someone with Cloudflare dashboard access confirms them.
