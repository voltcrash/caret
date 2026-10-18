# Oxytype deployment helpers

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
