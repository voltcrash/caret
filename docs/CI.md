# Continuous integration

[Oxytype CI](../.github/workflows/oxytype-ci.yml) runs on pull requests to
`main`/`stack/**`, pushes to `main` and manual dispatch. Successful main-push
runs trigger the [production deployment](PRODUCTION_SETUP.md).

## Jobs

`changes` maps changed paths onto jobs; everything else starts in parallel once
it finishes. Every job installs through
[`.github/actions/setup`](../.github/actions/setup/action.yml), which restores
the dependency and toolchain caches (`quality` saves them).

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
| `ci-assets` | `frontend/static`, CSS, runtime packages | Stylelint and asset validation |
| `ci-pkg` | `packages/**`, release workflow | Lint config audits, package lint and tests |
| `ci-ok` | Always | Fails if any selected job failed |

Root dependency, toolchain and CI files (lockfile, `patches/`, `.node-version`,
`packages/typescript-config`, `.github/actions`, the CI workflow) run
everything. Markdown, `docs/` and repository metadata run only `quality`.
"Runtime packages" are the workspace packages bundled into the app:
`challenges`, `contracts`, `funbox`, `schemas`, `typing-core` and `util`.

## Forcing runs

- Draft PRs skip CI; add the `force-ci` label to run it anyway.
- `force-full-ci` runs every job regardless of paths.
- **Run workflow** (`gh workflow run oxytype-ci.yml --ref <branch>`) runs every
  job. Manual runs never deploy.

## Changing CI

Add new paths to the matching `changes` filter, and new jobs to `ci-ok`'s
`needs`. When a suite grows, raise its shard count rather than its timeout.
