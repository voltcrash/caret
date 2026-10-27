# Caret deployment helpers

## Website production deployments

The **Production deployment** [workflow](../../.github/workflows/production-release.yml)
runs automatically after **Caret CI** completes successfully for a push to `main`.
It checks out and deploys that CI run's exact commit, even if `main` has advanced.
Failed, cancelled and pull-request CI runs cannot deploy. Manual dispatch from
`main` remains available, including another deployment of an unchanged commit. It
creates no GitHub release, tag, changelog, release snapshot or package-version edit.

`production-validation.js` requires the latest **Caret CI** main-push run for
that exact commit to finish successfully before credentials are prepared. Missing,
pending, failed or cancelled CI blocks deployment; retry after CI succeeds.
The workflow token has only Contents and Actions read permissions.

After the Worker dry-run, deployment detaches the retired production task consumer
before applying PostgreSQL migrations. Direct production/staging deploy commands also
retire their own consumer after artifact validation. Cleanup is repeatable and
preserves queues, DLQs and messages; Cloudflare API failures stop the deployment.
Removing a consumer from Wrangler config alone leaves its remote trigger attached,
so uploading a Worker without `queue()` otherwise fails with error 11001.

Worker, client, `/version.json` and service-worker caches share an internal build
ID made from the source SHA, workflow run ID and run attempt. Each deployment and
retry gets its own ID. It supports cache updates and deployment diagnostics;
the website has no release-version button or changes modal.

See [production setup](../../docs/PRODUCTION_SETUP.md#production-deployments)
for required Actions inputs, build validation, migrations and rollback.

Shared root manifests, lockfile, tool configuration and patches trigger all
component validation jobs, including asset checks. Component-only changes retain
selective CI routing.
