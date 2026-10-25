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

Historical rollback rehearsals and deployment observations (in git history)
do not close the compatibility window or certify the hosted deployment.

## Rust engine cutover

The website builds one Rust engine through browser-only Wasm. No permanent dual
engine fallback remains. Native `typing-engine` code, generated bindings, browser
glue and `.wasm` are a matched unit. Bootstrap runs before Vite in development,
production/staging and CI; the production workflow installs the pinned toolchain.

Wasm is content-addressed under `/assets/`, served as `application/wasm` with
immutable caching and the existing `wasm-unsafe-eval` CSP permission. Preserve
previous hashed Wasm **and** its importing JS graph. The public integrity index
includes both; failed/colliding captures stop the build. The service worker
precaches engine/glue for cached guest typing; it never caches private responses.
A missing or interrupted first download leaves typing disabled with Restart retry.

The original source anchor is
`7b1ae05f204be53b5d9f2714f21c6eea08b25935`; completed Stage 1
`dc843955a` also retains the original website runtime. Immutable references and
source provenance remain in `packages/typing-fixtures`. These Git anchors preserve
source; they are **not** claims about the currently hosted Worker version or an
archived deployed artifact.

Before the authorized production cutover, retain the currently deployed matched
Worker/assets artifact and record its Cloudflare version using the operations
guide above. Rehearse on the authorized staging deployment, including stale tabs,
settings, authenticated save retry, IME, historical replay and engine download
failure. This implementation has local workerd/matched-build update/rollback
evidence; it does not assert hosted staging/production verification. Rollback uses
the retained deployment artifact, without restoring D1 or rebuilding its client.
New and old tabs keep their own engine version throughout a test. Idle update
activation and pending-save protection are unchanged.

Frozen performance budgets and raw evidence live in `docs/rust-engine/`; keep the
original baseline files unchanged. `vp run engine:parity` compares native and
built-browser Wasm directly with the frozen reference outputs after retirement.
