# Staging browser setup

For Oxytype maintainers testing the official staging site.

Host frontend and API together at `https://oxytype-api-staging.voltcrash.workers.dev`
to keep OAuth state/session cookies on one origin. The steps below configure
credentials, deploy the site and enable browser testing.
See [Turnstile](TURNSTILE.md) for local test keys and policy.

## 1. GitHub credentials

Create an **Oxytype Staging** OAuth app in
[GitHub developer settings](https://github.com/settings/developers), following
[GitHub's registration guide](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app).

| Field | Value |
| --- | --- |
| Homepage URL | `https://oxytype-api-staging.voltcrash.workers.dev` |
| Callback URL | `https://oxytype-api-staging.voltcrash.workers.dev/api/auth/callback/github` |

Save its client ID and generated client secret in `frontend/.dev.vars.staging`:

```dotenv
GITHUB_CLIENT_ID=your-staging-client-id
GITHUB_CLIENT_SECRET=your-staging-client-secret
TURNSTILE_SECRET_KEY=your-staging-turnstile-secret
```

This ignored file is private. Preserve the existing remote `BETTER_AUTH_SECRET`;
do not copy local development vars or paste secrets into chat.

## 2. Turnstile credentials

Create a separate **managed** staging widget in the
[Cloudflare Turnstile dashboard](https://dash.cloudflare.com/?to=/:account/turnstile).
Allow `oxytype-api-staging.voltcrash.workers.dev` for the hosted staging frontend.
Allow `localhost` only when testing a local frontend.
The worker checks that hostname and each form's action through
[Siteverify](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

Use its secret in the backend file above. Save the matching public site key in
`frontend/.env.staging.local`:

```dotenv
BACKEND_URL=/api
TURNSTILE_SITE_KEY=your-staging-turnstile-site-key
AUTH_PROVIDERS=github
```

Development mode honors an explicit site key; ordinary local development uses
Cloudflare's test widget. Test secrets are rejected by production-mode Workers.

## 3. Build, publish and enable staging

Once all placeholders are replaced, run from the repo root:

```sh
vp run --filter @oxytype/frontend build:staging-site
vp run --filter @oxytype/frontend db:migrate:staging
vp run --filter @oxytype/frontend deploy:staging-site
```

Secret upload retains the existing auth secret. Build and deploy use Start's
generated client/server artifact; the staging check rejects a production build
or any changed file. Documents are rendered by native routes with no SPA fallback.
D1 migrations keep their existing history; never bootstrap/reset retained data.

## 4. Test the browser

Open `https://oxytype-api-staging.voltcrash.workers.dev/login` in your regular browser.
Sign in with GitHub, choose a username, complete Turnstile,
complete a test, refresh, then sign out/sign in and confirm the result remains.
Verify the browser requests the staging host. Use an ordinary typing sample to
check real-user anticheat compatibility.

OAuth returns the popup to `/oauth-callback.html?requestId=...`. The staging Worker
renders this standalone URL through its Start route. If the popup
shows the app's 404 page, close it, check the staging site's assets, refresh `/login`
and retry.

Use the hosted URL for staging auth checks. Localhost calling the remote API can
lose OAuth cookies under browser privacy protections; `SameSite=None` alone does
not prevent partitioning/blocking. See [Better Auth's cookie guidance](https://better-auth.com/docs/concepts/cookies).
Return to local Start testing with `vp run dev`.
See [operations](CLOUDFLARE_OPERATIONS.md)
and [anticheat limits](ANTICHEAT.md) for deployment and monitoring.
