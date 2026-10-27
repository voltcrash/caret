# Continuous integration

[Caret CI](../.github/workflows/caret-ci.yml) runs on pull requests to
`main`/`stack/**`, pushes to `main` and manual dispatch. Successful main-push
runs trigger the [production deployment](PRODUCTION_SETUP.md).

## Jobs

On pull requests, `changes` maps changed paths onto jobs; independent jobs start
in parallel once it finishes. SSR and browser jobs wait for `start-build`. Main pushes and manual runs run every job: a
deployment must not rely on a diff whose earlier commits' CI was cancelled.

Every job installs through
[`.github/actions/setup`](../.github/actions/setup/action.yml), which restores
the dependency cache (`quality` saves it) and the generated engine bindings;
only a binding cache miss (or the `engine` job) restores Rust and runs cargo.
Browser jobs use [`setup-chromium`](../.github/actions/setup-chromium/action.yml),
which caches the headless shell and installs missing system libraries through
[`apt-install`](../.github/actions/apt-install/action.yml): cached downloads,
and bounded retries on a stalled mirror.

| Job | Runs | Checks |
| --- | --- | --- |
| `quality` | Every change | Whole-repo format check; Knip unless docs/assets-only; Stylelint and asset validation when `frontend/static`, CSS, runtime packages or asset validator inputs change |
| `ci-be` | Backend, its tests, runtime packages, lint config | Lint, unit and PostgreSQL tests |
| `ci-fe` | Frontend, any frontend tests, backend, runtime packages, lint config | Lint, circular imports |
| `ci-fe-test` (2 shards) | Frontend, unit or Start tests, backend, runtime packages | Vitest |
| `start-build` | SSR or browser suite selected | Build and dry-run production Worker; share artifact |
| `start-ssr` | Frontend, Start tests, backend, runtime packages | Route checks, runtime-test build, SSR/workerd suites |
| `start-browser` (4 shards) | Same, plus `e2e`/`start-e2e` | Playwright suites using shared Worker |
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

## Forcing runs

- Draft PRs skip CI; add the `force-ci` label to run it anyway.
- `force-full-ci` runs every job regardless of paths.
- **Run workflow** (`gh workflow run caret-ci.yml --ref <branch>`) runs every
  job. Manual runs never deploy.

## Changing CI

Add new paths to the matching `changes` filter with a routing spec case, and
new jobs to `ci-ok`'s `needs`. Share build output before adding shards; each shard keeps its own fixture Worker and PostgreSQL databases.

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
