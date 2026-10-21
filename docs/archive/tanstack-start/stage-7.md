# Stage 7: offline, delivery and observability

Base: Stage 6 `170bae84e`, [PR #141](https://github.com/voltcrash/oxytype/pull/141).
All Stage 7 work: [PR #142](https://github.com/voltcrash/oxytype/pull/142), stacked
on Stage 6, in small commits. Stage 6 ledger/prerequisites verified at takeover;
working tree clean. No TUI changes. No Stage 8 production cutover.

Phases implemented in order: offline/PWA → delivery ownership → production
behaviour. **Phases 7.1–7.3 and Stage 7 exit complete.** Production still serves
the anchored legacy version; the release workflow is gated until Stage 8.

## Phase status

| Phase | Status |
| --- | --- |
| 7.1 PWA/offline | Complete |
| 7.2 Delivery ownership | Complete |
| 7.3 Production behaviour in staging | Complete; interactive OAuth sign-in left to Stage 8 browser acceptance |
| Stage 7 exit | Complete ([validation](evidence/stage-7-validation.json)) |

## 7.1 Offline ownership

Start emits the shared `/manifest.json` (replacing `manifest.start.webmanifest`),
one build ID in client, Worker, `/version.json` (TUI asset-cache key) and
`X-Oxytype-Build`, and `/sw.js` generated from the build's actual chunk graph.
Precache: client entry, typing route, declared typing modules (runtime, chrome,
typing leaf, result, typing modals) and their imports, CSS, default English,
fonts and manifest; a removed module fails the build. Install stores the guest
render of `/`, fetched without credentials, and rejects a shell from another
build. Documents are network-only; offline `/` gets the shell, other documents a
script-free 503 with a typing link. Content-addressed files are cache-first;
public static files revalidate. Auth, `/api`, `/_serverFn`, non-GET, ranges,
other origins and release metadata are never intercepted. No result replay.

Caches are versioned per build (`oxytype-start-<build>`); one previous Start
cache stays for open tabs. First install replaces the rollback workbox worker
at once, retires its caches and keeps its hashed assets for one generation.
Later workers wait; activation and reloads never happen while any tab is typing,
calculating, restarting or saving a result (both save callers are tracked).
Another build's server-function ID answers 409 with a refresh message; a failed
chunk confirmed against `/version.json` or a newer deployment shows a reload
prompt. The release check no longer purges Start caches (rollback unchanged).

Gate fix: a tab started offline from the shell revoked the session on
reconnect, because `loadUser` signed out on any account-load failure. Only an
authentication rejection (401/403, missing session) now signs out; network,
timeout, rate-limit and server failures keep the session, keep the existing
error notification and retry when back online or after 5/15/45 s. This also
applies to the rollback build. Recorded as a deliberate behaviour change.

## 7.2 Delivery ownership

`frontend/wrangler.production.json` and `wrangler.staging.json` preserve Worker
names, origin/custom domain, account and D1 IDs, migration directory, queues/DLQ,
Cron, observability and secret names; `nodejs_compat` is required by Start.
Generated client assets bypass Worker dispatch; Start owns documents, functions
and routes. Root `build`/`dev`/`start` use Start; frontend owns production and
staging builders, credential/public-input validation, artifact receipts,
migrations and deployment. One uncached compiler run emits matching client,
Worker, service worker and version; preview credentials never enter the archived
artifact; checks reject a changed file or the other environment's artifact.
Builds retain the previous deployment's public chunk graph for supported tabs.

Deleted `prepare-site.ts`, backend production config, legacy static copy/deploy
scripts and duplicated remote migration commands. Backend keeps schema history,
generation, local migrations, bootstrap/audits and the rollback validation build.
CI routes backend changes to Start Worker checks and dry-runs staging/production
configs. Release order: exact-SHA CI → build → validate/dry-run → archive (90
days) → compatible migrations → deploy → publish. `START_PRODUCTION_ENABLED=true`
gates scheduled and manual runs until Stage 8. Actions secret names unchanged.

Minifying the SSR environment (names kept) fixed the carried Worker regression.

## 7.3 Production behaviour

- Built Worker in workerd: workerd/SSR/bundle/SW-build suites, Start browser and
  typing parity, real D1 saves, update/rollback with a pending save (no second
  submission) and removed result function, offline typing after one visit.
- Staging (`oxytype-api-staging`): legacy → Start → legacy → Start → Start with
  retained assets → rollback drill → final artifact `9b1fbf4e`. Worker header and
  `/version.json` matched after every step; D1 rows unchanged
  ([deployments](evidence/stage-7-staging-deployments.json),
  [anchor](evidence/stage-7-staging-anchor.json)). Hosted routes, 490 current/
  retained assets, CSP, OAuth initiation/state cookie, stale-function 409, CSRF
  403 and hosted offline typing pass ([runtime](evidence/stage-7-staging-runtime.json)).
  Queue delivery and Cron logs carry the deployed build ID.
- Release correlation: request/job logs carry build, release, request kind,
  function ID and client build; browser Sentry release is the same build ID.

| Budget (Stage 0, unchanged) | Stage 7 median / p95 | Ceiling median / p95 |
| --- | --- | --- |
| Cold input ready (ms) | 402.4 / 741.7 | 788.1 / 1170.5 |
| Warm input ready (ms) | 276.6 / 332.4 | 427.3 / 484.3 |
| `/about` content (ms) | 163.8 / 242.5 | 365.5 / 383.8 |
| 1,000-word render (ms) | 53.6 / 82.7 | 85.2 / 116.8 |
| Letter update (ms) | 0.011 / 0.014 | 0.012 / 0.014 |
| Eager JS raw / gzip (B) | 382,606 / 128,954 | 922,918 / 321,462 |
| Worker startup (ms, local) | 307.9 / 311.5 | 389.3 / 575.9 |
| Result save (ms, local) | 11.2 / 15.2 | 29.1 / 45.4 |
| CPU per public read (ms, local) | 4.4 / 4.6 | 7.48 / 7.48 |
| Worker raw / gzip (B) | 2,019,580 / 590,733 | 4,517,181 / 822,854 |

D1 statement counts equal Stage 0 (4/6/19/7, save 18–20). Upload 1,972 KiB /
560 KiB gzip. Edge (staging, Cloudflare-reported): `/about` SSR CPU 24 / 97 ms
(p95 includes cold isolates), `/` 9 / 15 ms, public read function 5 / 11 ms,
Cron 3 ms; no exceeded limits. Legacy HTML was static, so SSR edge CPU is a new
reference, not a budget pass ([edge](evidence/stage-7-edge-cpu.json),
[browser](evidence/stage-7-browser-measurements.json),
[Worker](evidence/stage-7-worker-measurements.json)).

## Validation

[Command/result evidence](evidence/stage-7-validation.json). All 11 CI jobs pass
on implementation head `3d61217df`
([run](https://github.com/voltcrash/oxytype/actions/runs/39005385598)); later
commits are docs/evidence and one script-only package change (rerun below).
Local gate: lint (fe/be/pkg/root/config/suppressions), unit (fe 2,413, be 782 +
124 D1, packages 637), builds (Start, rollback, test, staging, production),
dry-runs, workerd 93, browser 61 + updates 3 + rollback 31, knip, styles,
assets, formatting, inventory/routes and all frozen budgets pass.

Failures found and fixed during the gate: session revocation on reconnect
(above); fixture readiness raced seeding (Playwright now waits for the ready
line); CI traces upload on browser failure. Earlier CI failures (minified-name
assumptions, scroll restoration, a TUI timeout) were fixed or not reproduced on
the final run. Package total 637 replaces Stage 6's misreported 736.

Not run: interactive GitHub sign-in on hosted staging (needs a human login;
initiation, callback URL and Secure/HttpOnly state cookie verified) and any
production deployment/migration (Stage 8).

## Remaining adapters and next-stage prerequisites

- Rollback Hono app/build, legacy entry, navigation/page bridges and backend
  local dev Worker remain validation targets only; delete with the old entry in
  Stage 8. Start neither imports nor dispatches through them.
- Keep the 47 old-tab HTTP transports for the [compatibility
  window](release.md#compatibility-window); external protocols stay.
- Stage 8: re-observe the production rollback anchor, complete browser
  acceptance including interactive OAuth on staging, set
  `START_PRODUCTION_ENABLED=true` only after acceptance, release through the
  workflow, then observe launch signals (version skew via request logs).
- Staging runs the final Stage 7 artifact; production is unchanged.
