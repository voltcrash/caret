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
| 8.3 Release, observe, retire compatibility | Not started: needs stack merge, staging acceptance with interactive OAuth, `START_PRODUCTION_ENABLED` |

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

## Remaining before Stage 8 exit

- Merge the stack (PRs #135–#142 and Stage 8) to `main`; the production
  workflow runs only on `main`.
- Re-observe the production rollback anchor; deploy the validated commit to
  staging; complete browser acceptance including interactive OAuth.
- Set `START_PRODUCTION_ENABLED=true`, release through the workflow, observe
  launch signals (input readiness, auth/session failures, save success and
  duplicates, Worker errors/CPU, queue/DLQ, route errors, version skew).
- Keep the 47 old-tab HTTP transports and the service worker's rollback-asset
  handling for the [compatibility window](release.md#compatibility-window)
  (≥30 days after last legacy HTML); then retire them and close the ledger.
