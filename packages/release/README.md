# Oxytype production release helpers

## Terminal npm releases

`terminal-release.js` supplies the manual
[Terminal npm release workflow](../../.github/workflows/tui-release.yml).
It normalizes UTC date versions (`getDateVersion`, `v26.10.04` → `26.10.4`;
unrelated to website release numbers) to npm semver, requires
`next` for prereleases, verifies the workflow checkout, and checks npm for
version collisions. An existing version from the same commit skips publication;
an existing version from another commit fails. No website deployment is involved.

The workflow runs on `main` in the `npm` environment, validates terminal/release
tests, installs and smokes the packed artifact, then publishes `tui/dist/npm`
with provenance. Configure npm trusted publishing or the bootstrap `NPM_TOKEN`
as described in [the terminal guide](../../docs/TUI.md). The TUI source manifest
stays private; publication uses the generated manifest and files whitelist.

## Website production releases

This package supplies the manual Cloudflare production workflow with release
planning, changelog, version and site-history helpers. Deployment uses the
explicit Wrangler production commands. See
[Cloudflare operations](../../docs/CLOUDFLARE_OPERATIONS.md).

Release versions are `YY.MM.NN`: two-digit year, month, and the sequence number
of that UTC month's releases from `01` (`version.js`). The first November 2026
release is `26.11.01` in `package.json` and `v26.11.01` in Git tags; the next,
on any later day, is `26.11.02`. Production GitHub release titles omit the `v`.
The month is taken when release planning starts. Publication timestamps retain
their full ISO year.

Any number of releases per month or day is allowed. A run whose snapshot is the
latest release skips; a tag left on the snapshot by a failed publication is
reused; numbers held by other releases or tags are never reused.

Frontend build IDs remain separate timestamp-and-commit identifiers for cache invalidation and diagnostics.

The production workflow refreshes `frontend/static/release.json` before building.
The snapshot contains the ten newest public releases and includes the planned
release notes. Drafts and prereleases are excluded. Ordinary frontend builds use
the checked-in snapshot; the footer and history modal fetch the site-hosted file.
Older history is linked to GitHub.

The **Production release** [GitHub workflow](../../.github/workflows/production-release.yml)
runs only when dispatched manually from `main`. It deploys the complete
production Worker site and publishes a release containing all changes since the
previous production release, retaining the run's original `main` snapshot on
retries. See [production automation setup](../../docs/PRODUCTION_SETUP.md#production-releases)
for required Actions inputs and first-release behavior.

`renumber-releases-cli.js` renamed the date-named releases created before this
scheme (dry run by default; `--apply` renames releases, tags and their links).

Before preparing credentials or deploying, the production workflow requires the
latest **Oxytype CI** main-push run for its exact commit to finish successfully.
Missing, pending, failed or cancelled CI blocks deployment; retry the production
run after that commit's CI succeeds. Older successful runs and PR merge snapshots
cannot satisfy this check. The workflow token has Actions read permission.

Shared root manifests, lockfile, tool configuration and patches trigger all
component validation jobs, including asset checks. Component-only changes retain
selective CI routing.
