# Release, rollback and old-client contract

Stage 0 performs no deployment or resource mutation. Read-only deployment/release
inspection establishes a concrete rollback anchor in [rollback.json](evidence/rollback.json).

Observed 2026-10-15:

- Production Worker `oxytype`, custom domain `oxytype.voltcrash.com`.
- Deployment `a6537265-9f30-4895-9a8d-b5ca075e995a`, 100% version
  `ad9a94aa-739f-4a95-bb20-c7782f4c5770`, created 04:50:16 UTC.
- [Successful production run](https://github.com/voltcrash/oxytype/actions/runs/38683451809)
  at source `e9bb89fe72b7af4f3078d821277dd38cad482a26`, followed by
  [v26.10.15](https://github.com/voltcrash/oxytype/releases/tag/v26.10.15)
  publication at 04:50:20 UTC. Release tag resolves to that commit; deployment
  and publication timestamps align with workflow order. Re-observe before cutover;
  this is a dated anchor, not an assertion that production will remain unchanged.
- GitHub release has no binary assets. The retained Cloudflare Worker version
  plus its associated asset version is the exact deployment rollback artifact;
  the tag/lockfile/config is the reproducible source fallback. Do not substitute
  Stage 0's test-key frontend build for a production rollback artifact.

Configuration to preserve: `backend/wrangler.production.json`, Worker name/domain,
account and D1 `43d104e9-2fef-43db-95d7-c64a08310714`, migration directory,
`TASKS` queue `oxytype-production-tasks`, DLQ `oxytype-production-dlq`, one-minute
Cron, observability, compatibility date/flags and `ASSETS`. Keep staging isolated
(`backend/wrangler.jsonc`, separate D1/queues). Preserve production auth/OAuth/
Turnstile secrets; do not archive secrets in evidence, public env or release assets.

## Coordination

1. Stage 1 develops a migration-only build/Worker target; production keeps the
   legacy build. Stage 0 PR is safe for the existing release flow: only docs,
   tests and opt-in tooling, no altered production entry/config or dependencies.
2. Existing `production-release.yml` runs on main daily at 00:17 UTC or manually,
   serializes runs, validates CI, builds frontend then backend, dry-runs, applies
   compatible D1 migrations, deploys, then publishes the release at its source SHA.
   Do not merge partial migration entry changes into this path. Keep migrations
   isolated until the native application passes the preceding gates; preserve
   the production path or explicitly gate the workflow during transition.
3. Stage 1 CI adds isolated Start checks. Stage 7 transfers production build and
   deploy ownership to frontend and expands path filters: backend services must
   rebuild/test the application Worker. Do not run legacy `prepare-site.ts` or
   a cached mismatched client/server artifact against Start output.
4. Before Stage 7/8 cutover, capture current deployment/version IDs and associated
   assets; retain the complete validated bundle, lockfile, public build settings,
   release ID and configuration manifest. Verify the previous version remains
   rollback-capable. Stage 7 tests previous-build tabs/SW and actual rollback in
   staging before production. Never rebuild client assets independently during rollback.
5. Roll back Worker + matching assets together; preserve D1 writes, secrets,
   queue/job identities and compatible storage. Framework migration itself
   requires no database restore. Any future incompatible schema change needs
   its own reviewed restore/forward-compatibility plan before release.

## Compatibility window

Default frozen here: retain necessary old web HTTP transports for **at least
30 days after the last legacy HTML is served**. This matches the old runtime
build/language cache's 30-day TTL. Keep published/external endpoints indefinitely
under their contracts; their lifetime is independent of this window.

During the window, Start server routes implement old request/response policies
over the same services as new functions. Keep no second router/business code,
no dual result submission, and no global fallback to the old SPA. Ledger entries
name which web-only adapters can retire. Cache-safe old hashed assets must remain
available for supported old tabs; user-independent offline documents must not
cache private HTML or function responses.

Retire web-only transports only after the minimum window, verified stale-tab
handling, and seven consecutive days with no supported legacy mutation traffic.
Stage 7 adds version/operation observability without logging tokens or result
payloads; absent evidence is not evidence of zero usage. Maintain the adapters
longer if that condition is not met. Old clients beyond support get an explicit
refresh/retry path after idle, not a false save acknowledgement.

Old SW facts: `/sw.js`, scope `/`, autoUpdate registration, clientsClaim and
cleanupOutdatedCaches; build caches assume `/js|css|webfonts/name.hash.ext`;
version/release are NetworkOnly. The broad non-`/api` NetworkFirst rule is unsafe
for Start functions. Stage 7 replaces it, versions caches with the build, excludes
auth/functions/mutations/private data, and deliberately preserves guest offline
typing. Service-worker update/activation and page refresh must wait for active
typing and pending saves; never auto-replay a failed result on update/reconnect.

Cloudflare's [rollback contract](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
currently permits the 100 most recent versions and does not restore connected
resources. Preserve the current anchor explicitly before it ages out; do not
assume a dated deployment stays rollback-capable indefinitely. Installed Wrangler
read-only `versions view` confirmed version 13, script ETag and runtime asset
configuration; sanitized metadata is included in the rollback evidence.

No unresolved product-scope decision blocks Stage 1. Actual package compatibility,
edge metrics, final release IDs, migration staging and old-tab acceptance are
explicit Stage 1/7 implementation gates, not silently completed by this document.
