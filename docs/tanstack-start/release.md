# Release, rollback and old-client contract

TanStack Start owns the production/staging build and deployment commands in
`frontend/`. The [production workflow](../../.github/workflows/production-release.yml)
deploys the exact successful main-push CI snapshot and supports manual retries.
It does not require `START_PRODUCTION_ENABLED` or publish numbered GitHub releases.
See [production setup](../PRODUCTION_SETUP.md), [staging setup](../STAGING_SETUP.md)
and [operations](../CLOUDFLARE_OPERATIONS.md) for commands and configuration.

## Deployment and rollback

- Build the client and Worker together, validate the artifact, dry-run, apply
  compatible D1 migrations and deploy the matched bundle.
- Preserve the production origin, Worker/D1 identities, auth/OAuth/Turnstile
  secrets, session cookie identity and compatible storage formats.
- Before deployment, record the current Cloudflare Worker version with its
  matching assets and verify rollback availability. Dated migration anchors
  are historical evidence, not a current rollback target.
- Roll back Worker and matching assets together. Never rebuild client assets
  independently or restore D1 for a code-only rollback. Cloudflare version
  rollback does not restore connected resources, secrets or data writes.
- Observe input readiness, auth/session failures, save success and duplicates,
  Worker errors/CPU, scheduled work, route errors and version skew.

## Compatibility window

Retain necessary old web HTTP transports for **at least
30 days after the last legacy HTML is served**. This matches the old runtime
build/language cache's 30-day TTL. Keep published/external endpoints indefinitely
under their contracts; their lifetime is independent of this window.

During the window, Start server routes implement old request/response policies
over the same services as new functions. Keep no second router/business code,
no dual result submission, and no global fallback to the old SPA. The [operation inventory](operations.json)
names which web-only adapters can retire. Cache-safe old hashed assets must remain
available for supported old tabs; user-independent offline documents must not
cache private HTML or function responses.

Retire web-only transports only after the minimum window, verified stale-tab
handling, and seven consecutive days with no supported legacy mutation traffic.
Use version/operation observability without logging tokens or result
payloads; absent evidence is not evidence of zero usage. Maintain the adapters
longer if that condition is not met. Old clients beyond support get an explicit
refresh/retry path after idle, not a false save acknowledgement.

## Service worker and retained assets

Keep `/sw.js` at its existing URL and scope. Builds precache guest typing, keep
one previous Start cache and retain the previous deployment's public chunk graph
for open tabs. Auth, functions, APIs, mutations and private HTML stay outside
shared offline caches. Activation and page refresh wait for active typing and
pending saves; updates/reconnects never automatically replay a failed result.

Historical legacy/Start rollback rehearsals and deployment observations are
in the [archived release record](../archive/tanstack-start/release.md) and
[stage reports](../archive/tanstack-start/README.md). They do not close the
compatibility window or certify the currently hosted deployment.
