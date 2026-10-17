# Production setup

For Oxytype maintainers operating the official production site.

One Worker serves the frontend and `/api` on `https://oxytype.voltcrash.com`.
Use `frontend/wrangler.production.json` explicitly. The default Wrangler config
targets staging; the production release workflow uses the production config.

## Resources

| Resource | Production |
| --- | --- |
| Worker/custom domain | `oxytype` / `oxytype.voltcrash.com` |
| D1 | `oxytype-production`, `43d104e9-2fef-43db-95d7-c64a08310714` |
| Queues | `oxytype-production-tasks`, `oxytype-production-dlq` |
| Turnstile | Managed **Oxytype production**, hostname `oxytype.voltcrash.com` |
| GitHub OAuth | **Oxytype**, separate from local/staging apps |

Workers.dev and preview URLs are disabled. Cloudflare manages the custom domain's
DNS record and TLS certificate through the [Workers custom-domain route](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).
Quote publishing additionally requires the optional
[external bridge](CLOUDFLARE_OPERATIONS.md#external-bridge).

## Private settings

Save backend credentials in ignored `frontend/.dev.vars.production`:

```dotenv
BETTER_AUTH_SECRET=replace-with-a-new-private-production-secret
TURNSTILE_SECRET_KEY=replace-with-production-widget-secret
GITHUB_CLIENT_ID=replace-with-production-client-id
GITHUB_CLIENT_SECRET=replace-with-production-client-secret
```

Keep this file private (mode `0600`). Preserve the production auth secret across
redeployments; never copy staging/local secrets into it. The OAuth application's
display name does not affect authentication. Its URLs must be:

- Homepage: `https://oxytype.voltcrash.com`
- Callback: `https://oxytype.voltcrash.com/api/auth/callback/github`

Save public build settings in ignored `frontend/.env.production.local`:

```dotenv
BACKEND_URL=/api
TURNSTILE_SITE_KEY=replace-with-production-widget-site-key
AUTH_PROVIDERS=github
```

Google login stays hidden until separately configured. Enabling `google,github`
also requires production Google OAuth credentials and a matching callback.
Linked providers remain manageable in account settings. Backend secrets are not
passed into the frontend build. Examples are checked in; actual files are ignored.

## Better Auth dashboard

The backend connects to [Better Auth Infrastructure](https://better-auth.com/docs/infrastructure/plugins/dashboard)
when `BETTER_AUTH_API_KEY` is configured. Add the private project API key to
`frontend/.dev.vars.production`, or save it as a separate GitHub Actions secret
named `BETTER_AUTH_API_KEY`. The daily workflow appends that secret to the private
backend file before deploying it to the Worker. Preserve the other backend
credentials; this API key does not replace `BETTER_AUTH_SECRET`.

In the dashboard's **Connect Your App** form, use:

- Base URL: `https://oxytype.voltcrash.com`
- Base Path: `/api/auth`

Deploy the integration before verifying the connection. Dashboard endpoints use
the plugin's signed authorization. Auth events use the Worker's `waitUntil` so
they can finish after the response. The client installs `dashClient()` for audit
log APIs. Activity tracking and Sentinel security policies remain opt-in; the
basic dashboard connection requires no database migration.

## First database setup

On a **new, empty** production D1 only:

```sh
vp run --filter @oxytype/frontend db:migrate:production
vp run --filter @oxytype/backend db:bootstrap:production
```

The atomic bootstrap refuses any existing application data. It enables signup,
public profiles, result saving and payload hash checks; automatic bans remain
disabled. Other features keep their base defaults. It creates no account or
administrator, and enables no privileged admin endpoints or quote
submission/publication. Do not rerun bootstrap during updates.

## Build and deploy updates

From the repo root, with Node/pnpm versions in `package.json`:

```sh
vp install --frozen-lockfile
vp run --filter @oxytype/frontend build:production-site
vp run --filter @oxytype/frontend deploy:production-dry-run
# Apply any newly added migrations before compatible code is deployed.
vp run --filter @oxytype/frontend db:migrate:production
vp run --filter @oxytype/frontend deploy:production-site
```

Production builds invoke one uncached Start compiler for matching client/Worker assets.
The receipt in frontend/dist/start/artifact.json fingerprints the complete artifact.
Deployment validates credentials, public settings, resource identity and every file;
changed or mismatched builds fail before upload. Production secrets stay in their
private file; local preview variables are removed from the archived artifact.

Stage 7 transfers tooling only. Production remains on the retained legacy version
until Stage 8 acceptance and cutover. The scheduled/manual workflow is gated by
repository variable START_PRODUCTION_ENABLED=true; enable only after that gate.

## Rollback

Roll back the Worker version; never rebuild or redeploy client assets alone.
A Worker version carries its own asset manifest, so both move together:

```sh
vp exec --filter @oxytype/frontend -- wrangler deployments list --config wrangler.production.json
vp exec --filter @oxytype/frontend -- wrangler rollback <version-id> --config wrangler.production.json
```

Confirm `/version.json` and the `X-Oxytype-Build` response header report the
same build. Rollback restores no bound resources: D1 writes, queues and secrets
stay. Open tabs keep working: service workers for the rolled-back build install
and wait until no tab is typing or saving; another build's server-function IDs
answer 409 and prompt a refresh instead of resubmitting. Staging exercised
legacy → Start → legacy and Start → Start rollbacks this way in Stage 7.

## Production releases

The **Production release** [Actions workflow](../.github/workflows/production-release.yml)
checks for new commits at `00:17 UTC` each day. It also supports **Run workflow**
on `main`. When commits have been added since the previous successful production
release, it deploys the complete frontend/API site with the production Wrangler
config, applies pending production D1 migrations, and publishes a GitHub release
only after deployment succeeds. Without new commits, it skips dependency setup,
builds, migrations, deployment and publication; the scheduled workflow run still
starts and records the skip reason.

Configure these Actions inputs in repository settings or the `production`
environment before the first run:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare token scoped to the production account, with Worker deployment, D1 migration, queue and custom-domain access. |
| Secret | `PRODUCTION_BACKEND_ENV` | Full contents of the existing private `frontend/.dev.vars.production` file, preserving the deployed auth/OAuth/Turnstile credentials. |
| Secret (optional) | `BETTER_AUTH_API_KEY` | Private Better Auth dashboard project key. Overrides the same key in `PRODUCTION_BACKEND_ENV`; uploaded only to the backend Worker. |
| Variable | `PRODUCTION_FRONTEND_ENV` | Full contents of `frontend/.env.production.local`: real production site key, `BACKEND_URL=/api`, and enabled auth providers. |

The account ID and isolated resource IDs come from `frontend/wrangler.production.json`.
The workflow writes credential files with mode `0600` for the validated production
commands, then removes them even on failure. It never bootstraps or resets the database.

Release versions use the release-planning execution date in `YY.MM.DD` format,
with a `v`-prefixed tag at the exact deployed `main` commit. Delayed runs and
retries use the current execution date rather than the workflow creation date.
The package version uses that date; Worker/client/SW/version.json use one build ID
(date plus source SHA). No version commit is pushed to main. The workflow archives
the complete matched artifact for 90 days before migrations/deployment; releases
are published only after a successful deploy.
The release notes list all commits added since the previous successful production
release, including older branch commits merged during the day. They are grouped
into Features (`feat`), Improvements (`impr`, `perf`), Fixes (`fix`) and Nerd
stuff (everything else); GitHub merge commits are omitted. Missed days are
included in the next successful release. The first scheduled release covers the
preceding execution UTC day; the first manual run covers its execution UTC day.
The first production release establishes the deployment baseline even without
recent commits. Subsequent runs compare commits, so a new commit still qualifies
when its file contents or rendered release notes are unchanged.

Before the frontend build, the workflow writes `frontend/static/release.json`
with the planned release's notes and the nine newest earlier public releases.
Drafts and prereleases are excluded. This includes the release being deployed
even though GitHub publication happens afterward. The generated snapshot is
bundled into the deployment; it does not create a commit on `main`.

The footer version and version-history modal read `/release.json` from the site,
without browser requests to GitHub's API. The modal shows at most ten releases
and links to [GitHub releases](https://github.com/voltcrash/oxytype/releases)
for older history. Hosting and the service worker avoid persistently caching the
snapshot so the next deployment can update it.

Runs are serialized. Rerunning a completed date skips deployment and publication.
A retry on a later UTC date also skips if its snapshot has already been released.
Retrying a failed run keeps its original `main` snapshot but uses the date when
the new attempt's release planning executes. An older snapshot cannot deploy over
already released commits. A date tag belonging to another commit or a conflicting
manual release stops the workflow before deployment.

After merging a fix for a failed release, start a new **Production release** run
from **main** in Actions, or run `gh workflow run production-release.yml --ref main`.
Rerunning the old failed run retains its original snapshot and cannot pick up the fix.

GitHub's scheduler can run late or drop jobs under load; 00:17 UTC is the requested
trigger time, not an exact-time guarantee. See [GitHub scheduling behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Browser verification and monitoring

Open `https://oxytype.voltcrash.com/login` in a regular browser. Sign in with
GitHub, choose a username, complete Turnstile and a typing test. Refresh, then
sign out/sign in and confirm the result remains. The popup returns to the
standalone `/oauth-callback.html` page; frontend and API cookies share one HTTPS origin.

Monitor Workers logs, D1 size/query latency and queue backlog/DLQ. Review rejected
and flagged results (`/admin/anticheat/summary`) and calibrate on captured
typing samples before enabling automatic bans; see [anticheat](ANTICHEAT.md).
Cron recovers durable jobs/outbox deliveries; see [operations](CLOUDFLARE_OPERATIONS.md).
Before future schema changes, capture a D1 backup and check code/schema rollback
compatibility. A Worker rollback retains D1 writes; never reset this database to
retry a deployment. Keep the production auth secret and credential files.
