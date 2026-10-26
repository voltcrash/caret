# Production setup

For Oxytype maintainers operating the official production site.

One Worker serves the frontend and `/api` on `https://caret.voltcrash.com`.
Use `frontend/wrangler.production.json` explicitly. The default Wrangler config
targets staging; the production release workflow uses the production config.

## Resources

| Resource | Production |
| --- | --- |
| Worker/custom domain | `oxytype` / `caret.voltcrash.com` |
| D1 | `caret-production`, `43d104e9-2fef-43db-95d7-c64a08310714` |
| Turnstile | Managed **Oxytype production**, hostname `caret.voltcrash.com` |
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

- Homepage: `https://caret.voltcrash.com`
- Callback: `https://caret.voltcrash.com/api/auth/callback/github`

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

- Base URL: `https://caret.voltcrash.com`
- Base Path: `/api/auth`

Deploy the integration before verifying the connection. Dashboard endpoints use
the plugin's signed authorization. Auth events use the Worker's `waitUntil` so
they can finish after the response. The client installs `dashClient()` for audit
log APIs. Activity tracking and Sentinel security policies remain opt-in; the
basic dashboard connection requires no database migration.

## First database setup

On a **new, empty** production D1 only:

```sh
vp run --filter @caret/frontend db:migrate:production
vp run --filter @caret/backend db:bootstrap:production
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
vp run --filter @caret/frontend build:production-site
vp run --filter @caret/frontend deploy:production-dry-run
# Detach the retired task consumer before migrations remove its tables.
vp run --filter @caret/frontend retire:production-task-consumer
# Apply any newly added migrations before compatible code is deployed.
vp run --filter @caret/frontend db:migrate:production
vp run --filter @caret/frontend deploy:production-site
```

Production builds invoke one uncached Start compiler for matching client/Worker assets.
The receipt in frontend/dist/start/artifact.json fingerprints the complete artifact.
Deployment validates credentials, public settings, resource identity and every file;
changed or mismatched builds fail before upload. Production secrets stay in their
private file; local preview variables are removed from the archived artifact.

Production deployments start automatically after successful main-push CI and use
that exact snapshot. Complete staging acceptance before the first Start cutover.

The retired `caret-production-tasks` consumer must be detached before uploading
the Worker without a queue handler. Removing `queues` from Wrangler configuration
does not detach an existing Cloudflare consumer; upload otherwise fails with
`Queue handler is missing` (11001). The retirement command uses
`CLOUDFLARE_API_TOKEN` and the account/Worker in `wrangler.production.json` to
remove only that consumer through the
[Queues API](https://developers.cloudflare.com/api/resources/queues/subresources/consumers/methods/delete/).
It preserves the task queue, DLQ and queued messages; normal message retention
still applies. Missing queues/consumers are a successful no-op; authentication,
permission and API failures stop deployment. The token needs **Queues Write**.
Direct `deploy:production-site` calls repeat this check after artifact validation;
dry-runs never detach consumers.

## Rollback

Roll back the Worker version; never rebuild or redeploy client assets alone.
A Worker version carries its own asset manifest, so both move together:

```sh
vp exec --filter @caret/frontend -- wrangler deployments list --config wrangler.production.json
vp exec --filter @caret/frontend -- wrangler rollback <version-id> --config wrangler.production.json
```

Confirm `/version.json` and the `X-Caret-Build` response header report the
same build. Rollback restores no bound resources: D1 writes, queues and secrets
stay. Open tabs keep working: service workers for the rolled-back build install
and wait until no tab is typing or saving; another build's server-function IDs
answer 409 and prompt a refresh instead of resubmitting. Staging exercised
legacy → Start → legacy and Start → Start rollbacks this way in Stage 7.

## Production deployments

The **Production deployment** [Actions workflow](../.github/workflows/production-release.yml)
runs automatically when **Oxytype CI** finishes successfully for each push to
`main`. Deployment checks out the completed CI run's exact commit, even if `main`
has advanced. Failed, cancelled, skipped and pull-request CI runs cannot deploy.
No manual trigger is needed after merging a change.

For a manual retry, use **Run workflow** on `main`, or
`gh workflow run production-release.yml --ref main`. Manual dispatch requires CI
to have passed already; it fails if CI is still pending. Each run deploys the
complete frontend/API site with the production Wrangler config, including a
repeat deployment of the same commit. It creates no GitHub release, tag,
changelog, release snapshot or package-version change.

The latest **Oxytype CI** main-push run for the exact snapshot must pass first.
Runs are serialized; the deployment validates the matched client/Worker artifact,
detaches the retired task consumer, applies pending compatible D1 migrations and
uploads it with Wrangler.

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

Worker, client, `/version.json` and service-worker caches share an internal
build ID: source SHA, workflow run ID and run attempt. Repeated deployments and
retries receive distinct IDs. This identifier supports cache updates, matching
artifacts and diagnostics; it is not a numbered release and has no home-page
version button or changes screen. The retained Cloudflare Worker version and its
matching assets remain the rollback artifact.

After merging a fix for a failed deployment, successful main CI automatically
starts a new **Production deployment** run for the fix. To retry a transient
deployment failure after CI has passed, manually dispatch from **main**.
Rerunning an old failed run retains its original snapshot and cannot pick up the fix.

## Browser verification and monitoring

Open `https://caret.voltcrash.com/login` in a regular browser. Sign in with
GitHub, choose a username, complete Turnstile and a typing test. Refresh, then
sign out/sign in and confirm the result remains. The popup returns to the
standalone `/oauth-callback.html` page; frontend and API cookies share one HTTPS origin.

Monitor Workers logs and D1 size/query latency. Review rejected
and flagged results (`/admin/anticheat/summary`) and calibrate on captured
typing samples before enabling automatic bans; see [anticheat](ANTICHEAT.md).
Cron refreshes rankings and purges expired records; see [operations](CLOUDFLARE_OPERATIONS.md).
Before future schema changes, capture a D1 backup and check code/schema rollback
compatibility. A Worker rollback retains D1 writes; never reset this database to
retry a deployment. Keep the production auth secret and credential files.
