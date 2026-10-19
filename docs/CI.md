# Continuous integration

[Oxytype CI](../.github/workflows/oxytype-ci.yml) runs on pull requests to
`main`/`stack/**`, pushes to `main` and manual dispatch. Successful main-push
runs trigger the [production deployment](PRODUCTION_SETUP.md).

## Jobs

On pull requests, `changes` maps changed paths onto jobs; everything else starts
in parallel once it finishes. Main pushes and manual runs run every job: a
deployment must not rely on a diff whose earlier commits' CI was cancelled.

Every job installs through
[`.github/actions/setup`](../.github/actions/setup/action.yml), which restores
the dependency cache (`quality` saves it).

| Job | Runs | Checks |
| --- | --- | --- |
| `quality` | Every change | Whole-repo format check; Knip unless docs/assets-only |
| `ci-be` | Backend, its tests, runtime packages, lint config | Lint, unit and D1 tests |
| `ci-fe` | Frontend, any frontend tests, backend, runtime packages, lint config | Lint, circular imports |
| `ci-fe-test` (2 shards) | Frontend, unit or Start tests, backend, runtime packages | Vitest |
| `start-ssr` | Frontend, Start tests, backend, runtime packages | Route checks, Worker builds, dry-run, SSR/workerd suites |
| `start-browser` (4 shards) | Same, plus `e2e`/`start-e2e` | Production-Worker Playwright suites |
| `start-updates` | Same, plus `update-e2e` | Service-worker update and rollback suites |
| `start-delivery` | Frontend, backend, runtime packages | Staging and production builds + dry-runs |
| `ci-assets` | `frontend/static`, CSS, runtime packages, asset validator inputs and constants | Stylelint and asset validation |
| `ci-pkg` | `packages/**` | Lint config audits, package lint and tests |
| `ci-ok` | Always | Fails if any selected job failed |

Root dependency, toolchain and CI files (lockfile, `patches/`, `.node-version`,
`packages/typescript-config`, `.github/actions`, the CI and release workflows) run
everything. Markdown, `docs/` and repository metadata run only `quality`.
"Runtime packages" are the workspace packages bundled into the app:
`challenges`, `contracts`, `funbox`, `schemas`, `typing-core` and `util`
(excluding their tests and fixtures, which run only `ci-pkg`).

Cross-suite inputs also select their consumers: backend test data and D1
helpers run the frontend unit and SSR suites, browser fixtures run the update
suite, top-level `frontend/static` files run the Start suites, layouts run
frontend and package tests, and typing-core fixtures run backend and frontend
tests. [`ci-routing.spec.js`](../packages/release/__tests__/ci-routing.spec.js)
covers these rules.

## Forcing runs

- Draft PRs skip CI; add the `force-ci` label to run it anyway.
- `force-full-ci` runs every job regardless of paths.
- **Run workflow** (`gh workflow run oxytype-ci.yml --ref <branch>`) runs every
  job. Manual runs never deploy.

## Changing CI

Add new paths to the matching `changes` filter with a routing spec case, and
new jobs to `ci-ok`'s `needs`. When a suite grows, raise its shard count rather than its timeout.
