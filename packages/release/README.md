# Oxytype deployment and terminal release helpers

## Terminal npm releases

`terminal-release.js` supplies the manual
[Terminal npm release workflow](../../.github/workflows/tui-release.yml).
It normalizes UTC date versions (`getDateVersion`, `v26.10.04` → `26.10.4`)
to npm semver, requires `next` for prereleases, verifies the workflow checkout,
and checks npm for version collisions. An existing version from the same commit
skips publication; an existing version from another commit fails.

The workflow runs on `main` in the `npm` environment, validates terminal/release
tests, installs and smokes the packed artifact, then publishes `tui/dist/npm`
with provenance. Configure npm trusted publishing or the bootstrap `NPM_TOKEN`
as described in [the terminal guide](../../docs/TUI.md). The TUI source manifest
stays private; publication uses the generated manifest and files whitelist.

## Website production deployments

The **Production deployment** [workflow](../../.github/workflows/production-release.yml)
runs only when dispatched manually from `main`. Every dispatch builds and deploys
the run's snapshot, including another deployment of an unchanged commit. It
creates no GitHub release, tag, changelog, release snapshot or package-version edit.

`production-validation.js` requires the latest **Oxytype CI** main-push run for
that exact commit to finish successfully before credentials are prepared. Missing,
pending, failed or cancelled CI blocks deployment; retry after CI succeeds.
The workflow token has only Contents and Actions read permissions.

Worker, client, `/version.json` and service-worker caches share an internal build
ID made from the source SHA, workflow run ID and run attempt. Each dispatch and
retry gets its own ID. It supports cache updates and deployment diagnostics;
the website has no release-version button or changes modal.

See [production setup](../../docs/PRODUCTION_SETUP.md#production-deployments)
for required Actions inputs, build validation, migrations and rollback.

Shared root manifests, lockfile, tool configuration and patches trigger all
component validation jobs, including asset checks. Component-only changes retain
selective CI routing.
