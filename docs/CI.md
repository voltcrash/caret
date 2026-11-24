# Continuous integration

[Caret CI](../.github/workflows/caret-ci.yml) runs on pull requests to
`main`/`stack/**`, pushes to `main` and manual dispatch. Successful main-push
runs trigger the [production deployment](PRODUCTION_SETUP.md).

See [CI performance](CI_PERFORMANCE.md) for browser measurements, task caching
and runner benchmarks.

## Jobs

On pull requests, `changes` maps changed paths onto jobs; independent jobs start
in parallel once it finishes. SSR and browser jobs wait for `start-build`. Main pushes and manual runs run every job: a
deployment must not rely on a diff whose earlier commits' CI was cancelled.

Every job installs through
[`.github/actions/setup`](../.github/actions/setup/action.yml), which restores
the dependency cache (`quality` saves it) and the generated engine bindings;
only a binding cache miss (or the `engine` job) restores Rust and runs cargo.
Chromium-only jobs use [`setup-chromium`](../.github/actions/setup-chromium/action.yml),
which caches the headless shell and installs missing system libraries through
[`apt-install`](../.github/actions/apt-install/action.yml): cached downloads,
and bounded retries on a stalled mirror. The cross-browser smoke suite uses the
official Playwright image matching the installed client version.

| Job | Runs | Checks |
| --- | --- | --- |
| `quality` | Every change | Whole-repo format check; Knip unless docs/assets-only; Stylelint and asset validation when `frontend/static`, CSS, runtime packages or asset validator inputs change |
| `ci-be` | Backend, its tests, runtime packages, lint config | Lint, unit and PostgreSQL tests |
| `ci-fe` | Frontend, any frontend tests, backend, runtime packages, lint config | Lint, circular imports |
| `ci-fe-test` (2 shards) | Frontend, unit or Start tests, backend, runtime packages | Vitest |
| `start-build` | SSR or browser suite selected | Build and dry-run production Worker; eager JS budget; share artifact |
| `start-ssr` | Frontend, Start tests, backend, runtime packages | Route checks, runtime-test build, SSR/workerd suites |
| `start-browser` (6 shards) | Same, plus `e2e`/`start-e2e` | Playwright suites using shared Worker |
| `start-updates` | Same, plus `update-e2e` | Service-worker update and rollback suites |
| `start-delivery` | Frontend, backend, runtime packages | Staging and production builds + dry-runs |
| `ci-pkg` | `packages/**` | Lint config audits, package lint and tests |
| `ci-ok` | Always | Fails if any selected job failed |

Root dependency, toolchain and CI files (lockfile, `patches/`, `.node-version`,
`packages/typescript-config`, `.github/actions`, the CI and release workflows) run
everything. Markdown, `docs/` and repository metadata run only `quality`.
"Runtime packages" are the workspace packages bundled into the app:
`challenges`, `contracts`, `funbox`, `schemas`, `typing-core` and `util`
(excluding their tests and fixtures, which run only `ci-pkg`).

Cross-suite inputs also select their consumers: backend test data and PostgreSQL
helpers run the frontend unit and SSR suites, browser fixtures run the update
suite, top-level `frontend/static` files run the Start suites, layouts run
frontend and package tests, and typing-core fixtures run backend and frontend
tests. [`ci-routing.spec.js`](../packages/release/__tests__/ci-routing.spec.js)
covers these rules.

## Eager JS budget

`start-build` runs `measure-eager-js.ts --check` on the built Worker. It sums the
typing document's entry scripts and modulepreloads (lazy chunks excluded) and
fails when raw or gzip bytes exceed
[`eager-js-budget.json`](../frontend/scripts/eager-js-budget.json). Prefer
deferring code off the first-keystroke path; otherwise raise the budget in the
same PR so reviewers see the growth.

## Forcing runs

- Draft PRs skip CI; add the `force-ci` label to run it anyway.
- `force-full-ci` runs every job regardless of paths.
- **Run workflow** (`gh workflow run caret-ci.yml --ref <branch>`) runs every
  job. Manual runs never deploy.

## Changing CI

Add new paths to the matching `changes` filter with a routing spec case, and
new jobs to `ci-ok`'s `needs`. Share build output before adding shards; each shard keeps its own fixture Worker and PostgreSQL databases.

Pin every third-party GitHub Action in `.github/workflows/` and
`.github/actions/` to a full 40-character commit SHA with the version tag as a
trailing comment (for example, `actions/checkout@<sha> # v7.0.1`).

## Security scans

[Security scans](../.github/workflows/security.yml) runs on pull requests to
`main`/`stack/**`, pushes to `main`, weekly on Mondays, and manual dispatch:

- `dependency-audit`: gates on production JS advisories (`vp pm audit -- --prod`)
  and publishes the full workspace advisory table (including dev dependencies)
  as a job summary and downloadable artifact.
- `cargo-audit`: audits `Cargo.lock` against RustSec advisories on same-repo runs.
- `secret-scan`: runs `vp run security:secret-scan` (`scripts/secret-scan.ts`)
  over tracked text files for known credential and private-key formats without
  printing matched values.

## Test structure

`vp test run` runs backend, frontend and packages in one workspace runner.
`vp run test-be`, `vp run test-fe` and `vp run test-pkg` select projects from that
same configuration. For one file, use `vp test run path/to/file.spec.ts`.

Backend unit tests use lightweight mocks. Only HTTP/auth/controller suites
start a migrated PostgreSQL runtime; PostgreSQL integration tests retain independent databases.
Pure frontend suites run in Node without application mocks or DOM emulation.
DOM logic and Solid component suites keep their respective browser environments.

Prefer behavior assertions and small case tables. Test shared logic in its
own package; frontend adapters cover the wiring. Keep fixtures read-only during
normal runs. Broad metadata snapshots, source-text style checks and tests of
third-party generators add maintenance without exercising application behavior.
