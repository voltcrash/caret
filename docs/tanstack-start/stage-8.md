# Stage 8: remove the old architecture and cut over

Base: Stage 7 `bb8dd2cd3`, [PR #142](https://github.com/voltcrash/oxytype/pull/142).
Branch `stack/stage-eight-start-migration`, [PR #143](https://github.com/voltcrash/oxytype/pull/143), stacked on Stage 7, in small commits.
Stage 7 ledger/prerequisites verified at takeover; working tree clean. No TUI
changes.

## Phase status

| Phase | Status |
| --- | --- |
| 8.1 Delete superseded code, document the system | Complete |
| 8.2 Migration acceptance gate | Complete: local gate + all 12 CI checks on `200f0a710` ([validation](evidence/stage-8-validation.json), [run](https://github.com/voltcrash/oxytype/actions/runs/39099769261)) |
| 8.3 Release, observe, retire compatibility | In progress: stack merged, main CI green, human staging acceptance passed; auth fixes #146 awaiting merge; production pending |

## 8.1 Deleted

Frontend: legacy Vite build (`vite.legacy.config.ts`), `index.html` and the
standalone HTML entries/renderer, `ts/index.ts`, `AppRouter`/`App`,
`LegacyRuntime`, `NavigationRuntime`, `navigation/routes.ts`, `LinkPrefetch`,
page controller, cached `Page` lifecycles, `AppPages`, page wrappers, `activePage`
and page-transition state, loading-page/results-ready/app-loading state, the
rollback HTTP operation transport, Solid Router, the global auth startup
callback (`init`, `authReadiness`, `onAuthStateChanged`, `authStateChanged`),
`useUrlEvents`, release-change cache purge, the settings-section and
leaderboard page mirrors, the devtools signal-tracker entry and legacy-only
plugins/deps (vite-plugin-pwa, minify, html-inject, preload, subset-font,
fontawesome-subset, solid-devtools, @solidjs/router).

Backend: Hono app, legacy Worker and static frontend dispatch, ts-rest/Hono
adapters, middlewares, auth route shim, Redocly docs/asset build, legacy-bundle
baseline script, backend Worker env examples, `hono`, `@hono/node-server`,
`@redocly/cli`. `backend/wrangler.jsonc` now binds D1 only.

Tooling: legacy Playwright configs and `test-e2e:legacy` CI job,
`build:legacy`/`dev:legacy`/`build-be`/`dev-be`, backend CI build step.

Moved: imperative navigation to `app/navigate.ts`, typing guard to
`app/navigation-guard.client.ts`, PSAs to `features/announcements`.

Gaps found and fixed (legacy-only behaviour Start had silently lost):

- Server announcements (PSAs) and outage/maintenance banners never loaded.
- Banner height never padded `#app`; fix-skill-issue showed nothing; dev options,
  event-log and `DEV_TOOLS` devtools never mounted; offline notice missing.
- Sentry kept the previous account's identity after sign-out.
- `DEV_LINT`/`DEV_INSPECT`/`DEV_TOOLS`/`DEV_PREFETCH` were not wired to Start dev.
- Storybook rendered app state without an application (7 failing stories).

Tests retargeted, not dropped: backend controller (402), auth (42) and D1 (124)
suites run through a test dispatcher over the same backend handlers Start
mounts under `/api`; Hono middleware specs became authentication,
configuration and permission policy specs (54); transport-independent
`app.spec` cases moved to `http/handler.spec`. Hono-only cases (CORS, body
parsing, docs, case/trailing slashes) are covered by Start's workerd HTTP suite.

Import graph: knip reports nothing unused; the layer suite forbids ts-rest/Hono
clients in web code and backend imports outside narrow server subpaths.

Intentional changes: maintenance 503 bodies carry an `errorId` (status and
message unchanged); the PSA alerts list is replaced per fetch instead of
appended; signal tracking (`DEV_TOOLS`) was dropped.

## 8.2 Acceptance gate

[Command/result evidence](evidence/stage-8-validation.json). Lint (all
workspaces, config, suppressions), unit (fe 2,315, be 743 + 124 D1, packages 637),
inventory/routes checks, knip, styles, assets, formatting, Start/test/staging/
production builds and dry-runs, workerd 93, browser 61, updates 3 and Storybook
120 pass. Isolation, direct function authorization, malformed inputs, private
cache exclusion, CSP, route statuses, deep links and fallback HTML are covered
by the workerd and browser suites.

| Budget (Stage 0, unchanged) | Stage 8 median / p95 | Ceiling median / p95 |
| --- | --- | --- |
| Cold input ready (ms) | 570.6 / 660.8 | 788.1 / 1170.5 |
| Warm input ready (ms) | 347.3 / 410.7 | 427.3 / 484.3 |
| `/about` content (ms) | 245.1 / 280.9 | 365.5 / 383.8 |
| 1,000-word render (ms) | 65.4 / 114.1 | 85.2 / 116.8 |
| Letter update (ms) | 0.012 / 0.035 | 0.012 / 0.014 |
| Eager JS raw / gzip (B) | 382,790 / 129,063 | 922,918 / 321,462 |
| Worker raw / gzip (B) | 2,019,643 / 590,782 | 4,517,181 / 822,854 |

Measured on Linux aarch64, slower than the Stage 0/7 macOS reference. Letter
update p95, Worker startup, save latency and local CPU per read exceed their
ceilings here for **both** the Stage 7 tip and Stage 8 HEAD; alternating
same-machine runs put Stage 8 within noise of Stage 7
([comparison](evidence/stage-8-budget-comparison.json),
[Worker](evidence/stage-8-worker-measurements.json)). Thresholds unchanged;
re-measure on the reference machine or CI before closing the gate. D1 statement
counts equal Stage 0 (4/6/19/7, save 18–20).

## 8.3 Staging cutover checks

The stack through #144 is merged at `1776ac5f1`; all main CI jobs pass
([run](https://github.com/voltcrash/oxytype/actions/runs/39101773911)).
Deployed that commit to staging using existing remote secrets; no private
backend settings were copied to this machine. Staging and production have no
pending D1 migrations.

Interactive GitHub sign-in created a working session and saved results, but its
popup showed `state_mismatch`. Navigation preload sent the one-use callback
before the bypassed navigation sent it again. [#146](https://github.com/voltcrash/oxytype/pull/146)
reuses the preload response without caching auth responses. The regression fails
before the fix and passes afterwards; six auth/offline browser tests, 39 policy
tests and type-aware lint pass.

The fix at `cc3441ece` is deployed to staging as build
`2026.10.18_11.36_cc3441ece`, Worker version
`abeb97f8-ed9c-4b77-af62-baa063b5daab`. Hosted checks verify 711 current/retained
assets, routes, CSP, OAuth cookies, stale functions and offline typing. A synthetic
provider denial returns the expected callback with preload both enabled and
disabled. Human recheck confirms sign-in and persisted typing results;
header sign-out exposed the separate session-state issue below.
[Cutover evidence](evidence/stage-8-cutover.json).

Header sign-out disposed the account but left a signed-in session cached. The
session owner could restore that identity, producing an Unauthorized toast and
a broken page. The follow-up at `ec3cb0fa5` cancels pending session queries,
publishes a guest session before disposing account data, and compares successive
canonical sessions when invalidating routes. Both header paths (`/account` and
`/`) now pass: private routes redirect to login and guest typing remains usable.
Eight auth/offline browser tests and 22 targeted unit tests pass; this latest
artifact is deployed as `2026.10.18_11.47_ec3cb0fa5`, Worker version
`808da37b-6ec1-4dc7-a037-ab2ce9b7909c`. Hosted runtime checks verify 816
current/retained assets; offline typing passes. Human recheck after reloading
staging confirms header sign-out works without the Unauthorized notification or
the broken-page screen. Interactive sign-in, saved results and sign-out are
accepted.

The six original commits were split into focused signed commits for #146.
Before recording human acceptance, the reconstructed tree at `d52ff9ddb` matched
the original `9875e0c53` exactly (`git diff --exit-code` passed). Staging build and
source IDs above identify the tested artifacts deployed before that history rewrite.

Production was re-observed on October 18: version
`a59fe11e-0e88-4483-a837-0b65ef3c7212` still serves the October 16 legacy build,
source `d6e5be3e9`, now tagged `v26.10.11`. This newer matched Worker/assets
version supersedes the dated October 15 rollback anchor for the upcoming cutover.
Production remains gated; no production deployment was performed.

## Remaining before Stage 8 exit

- Merge #146 after CI passes; the production workflow runs only on `main`.
- Releases are manual-only with `YY.MM.NN` numbers (#144); the rollback anchor
  `v26.10.15` is `v26.10.10` after renumbering (same commit `e9bb89fe7`).
- Set `START_PRODUCTION_ENABLED=true`, dispatch the release workflow, observe
  launch signals (input readiness, auth/session failures, save success and
  duplicates, Worker errors/CPU, queue/DLQ, route errors, version skew).
- Keep the 47 old-tab HTTP transports and the service worker's rollback-asset
  handling for the [compatibility window](release.md#compatibility-window)
  (≥30 days after last legacy HTML); then retire them and close the ledger.
