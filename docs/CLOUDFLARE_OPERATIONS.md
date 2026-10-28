# Cloudflare operations

For local contributors and maintainers operating Caret staging and production.

Backend runtime: one Worker, Neon PostgreSQL through Cloudflare Hyperdrive (TCP), and Cron.
Local development uses a separate Neon branch through the local Hyperdrive binding. Set `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` in `frontend/.dev.vars`. Tests run PostgreSQL in PGlite over TCP without external credentials.
The [production setup](PRODUCTION_SETUP.md) uses an isolated database and
`frontend/wrangler.production.json`.

## Local development

```sh
vp install --frozen-lockfile
vp exec cp frontend/.dev.vars.example frontend/.dev.vars
vp run --filter @caret/frontend db:migrate
vp run dev
```

Start serves document, assets, functions and /api at http://localhost:3000.
Set DATABASE_URL in frontend/.dev.vars to a development Neon branch before migrating.
Migrations run against that URL; never use production credentials for local development. Result/telemetry validation runs in development and production;
never copy the development secret/test captcha key into a production deployment.
Use `.dev.vars` for Worker settings, not Node `.env`.

Google/GitHub social sign-in needs a provider's backend-only client ID/secret.
Register `BETTER_AUTH_URL/callback/google` or `/github`; local URL is
`http://localhost:3000/api/auth`. Email/password/reset flows stay disabled.
Signup defaults disabled in BASE_CONFIGURATION; enable deliberately
through the admin configuration contract/PostgreSQL, not by weakening guards. XP, the
weekly XP leaderboard and daily leaderboards (English time 15/60) default
enabled.

Verification:

```sh
vp lint --type-aware --type-check --format agent backend
vp run --filter @caret/backend test
vp run --filter @caret/backend integration-test
vp -C backend test run __tests__/postgres/http.spec.ts
vp run --filter @caret/frontend test:start
```

Start generates retained API docs and uses curated frontend/static assets.
Private backend editor/config assets never enter the public asset directory.
The PostgreSQL suite runs actual PostgreSQL in PGlite through the `pg` driver and PGlite socket server.
Start workerd fixtures intercept the same HTTP protocol and execute PostgreSQL.

## Staging deployment

Dedicated account: Lakshmi Tanmay, `eb2679ce4f23ae7db4e6c4e3fcf8c3c1`.
Worker: [caret-api-staging](https://caret-api-staging.voltcrash.workers.dev).
Auth URL: `https://caret-api-staging.voltcrash.workers.dev/api/auth`.
Set DATABASE_URL in frontend/.dev.vars.staging to an isolated Neon branch.
Start delivery uses frontend/wrangler.staging.json; production uses its separate
frontend/wrangler.production.json. Preserve existing remote auth/OAuth secrets.

```sh
vp run --filter @caret/frontend build:staging-site
vp run --filter @caret/frontend db:migrate:staging
vp run --filter @caret/frontend deploy:staging-site
```

Generate the secret privately (`openssl rand -base64 32`); preserve it across
redeployments. Set `BETTER_AUTH_URL` in Wrangler vars to the deployed URL plus
`/api/auth`, rebuild/redeploy. Do not put secrets in git. Optional secrets:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET`, `TURNSTILE_SECRET_KEY`,
`INTEGRATION_SECRET`.
Optional nonsecret vars: `INTEGRATION_URL`, `QUOTES_REPOSITORY`.

Without OAuth credentials no social login is available. Without a real Turnstile
secret production signup fails closed. [Turnstile setup](TURNSTILE.md) covers widget
hostnames, form actions, test keys and token renewal. Built-in [anticheat](ANTICHEAT.md) permits
valid production result saves and rejects inconsistent telemetry. No bypass is
supported. Follow [staging browser setup](STAGING_SETUP.md) to configure signup,
profiles and result saving, then verify them in a browser. Keep automatic bans
disabled while reviewing real typing samples. Use Cloudflare Analytics and
Workers logs for diagnostics.

Cross-site staging cookies use Secure/SameSite=None and explicit localhost
origin checks. Some browsers block third-party cookies; a same-site frontend/API
proxy is preferable for end-to-end OAuth testing.

## External bridge

`INTEGRATION_URL` must be HTTPS; bearer auth uses `INTEGRATION_SECRET`.
Every POST supplies `Idempotency-Key`; successful replies must be JSON.

- `quotes/approve`: payload from `dal/new-quotes.ts`, including the allowed
  repository and quote. Restrict repository/origin to deployment-owned Caret
  repos; reject upstream repositories. Commit/publish quote assets externally.
  Persist the approval ID so HTTP retries cannot append a quote twice.

Missing integrations return explicit 503 and retain quote submissions for retry.
A bridge implementation and OAuth provider credentials are not supplied here.

## Scheduled maintenance

Two Cron triggers: `*/15 * * * *` rebuilds indexed all-time
snapshots/histograms; `0 * * * *` purges expired auth records/counters, 30-day
nonimportant audits and expired daily/weekly leaderboard entries.
Important audits and results have no automatic deletion policy; monitor their
growth. Inspect Workers logs for failed maintenance invocations.

Quote approval calls the external bridge directly. Failed submissions remain
available for an explicit retry with the same approval idempotency key.

## Rate limiting

API, session-read and auth routes use Workers rate limiting bindings, not D1.
Bindings allow only 10s or 60s periods with a fixed limit, so each distinct
budget is one `RATE_LIMIT_<period>S_<limit>` binding. Contract windows over a
minute become a per-minute budget of 4x their average rate, at least 30 and at
most the window's max (root: 1,000/hour becomes 67/minute; 60/hour becomes
30/minute; 3/day becomes 3/minute). The D1 limiter allowed a whole window at
once, and a signed-in page load reads several low-volume operations, so
smaller budgets rejected ordinary reloads. Counts are per Cloudflare location and eventually consistent.
Development (`MODE=dev`) skips the bindings. Responses send
`X-RateLimit-Limit` and, when limited, `Retry-After`; there is no
Remaining/Reset.

`frontend/__tests__/scripts/wrangler-bindings.spec.ts` fails when a contract
change needs a binding a Wrangler config lacks. Namespace IDs are
account-wide: production 1xxx, staging 2xxx, local 3xxx. Never reuse them.

Bad-authentication points (when enabled in configuration) live in the
location's Cache API for an hour. The Cache API is a no-op on `workers.dev`
hostnames, so staging does not enforce this policy or the public-read cache.

Migration `0018_drop_d1_rate_counters.sql` drops the former `rate_counters`
and `auth_rate_limits` tables. Deploy the Workers rate limiting release first:
the migration step runs before the Worker upload, and older Workers write
those tables on every request. A Worker-only rollback past that release
needs the tables recreated.

## Caching and staleness

| Data | Where | Maximum staleness |
| --- | --- | --- |
| Configuration | Isolate memory | 30s (patching isolate: immediate) |
| Cookie session | Signed cookie | 60s after revoke/disable |
| Public reads (`policies/edge-cache.ts`) | Location Cache API | 30–300s |

`Cache-Control: no-cache` requests bypass the public-read cache. Fresh-token
and admin operations, Bearer tokens, the auth handler and the UI session
always read the session row. Cached hits skip rate limits.

## Request metrics

Every request writes one data point to the `METRICS` Analytics Engine dataset
(`caret_requests` production, `caret_staging_requests` staging).
Columns are append-only:

| Column | Value |
| --- | --- |
| `index1`, `blob1` | Operation ID, or route kind for documents/multi-op calls |
| `blob2`–`blob5` | Kind, method, status, edge cache `hit`/`miss` |
| `blob6`, `blob7` | Release, build |
| `double1`–`double4` | Duration ms, status, PostgreSQL statements, operations |

p95 latency per operation over the last hour (SQL API):

```sql
SELECT blob1 AS operation,
  quantileExactWeighted(0.95)(double1, _sample_interval) AS p95_ms,
  sum(_sample_interval * double3) / sum(_sample_interval) AS d1_per_request
FROM caret_requests
WHERE timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY operation ORDER BY p95_ms DESC
```

## PostgreSQL operations

DATABASE_URL is a private PostgreSQL connection URL from Neon, with sslmode=require.
Keep separate development, staging and production databases/branches. Production
Worker name is caret; it has no D1 binding. GitHub Actions reads the DATABASE_URL
secret, writes it into private Worker settings, applies migrations, then deploys.

Migrations live in backend/migrations and use Drizzle PostgreSQL schemas. Each
migration and its journal entry commit in one PostgreSQL transaction. A fresh,
empty database is initialized from backend/bootstrap/production.sql; existing
configuration is preserved. No D1 data is imported or deleted.

```sh
vp run --filter @caret/backend db:generate
vp run --filter @caret/frontend db:migrate:production
```

All reads use the Neon primary. Each invocation owns a lazy `pg` pool, closed when its work completes,
shared with Drizzle. User writes lock the versioned user row, assert its version,
and commit progression, history, ranking changes and receipts atomically. A
conflict retries from a fresh user snapshot. Retryable transport/transaction
errors use bounded retries; durable receipts prevent duplicate increments after
lost acknowledgements. Cron deletes receipts after seven days. Capped preset,
quote and report writes are serialized to preserve their limits under Postgres.

Workers Analytics Engine keeps its existing column order; double3 now counts
PostgreSQL statements. Use Neon monitoring/query statistics for database latency,
capacity and slow queries. The D1 Insights workflow, PRAGMA optimize commands,
and D1 replica setup are retired.

Production keeps Smart Placement. Recover database changes using Neon backup/
restore or branching tools, and check schema compatibility before Worker rollback.
A Worker rollback retains PostgreSQL writes and secrets. Pre-Neon Workers require
D1, so they cannot be used for a code-only rollback after this cutover.

See [Hyperdrive with Neon](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/neon/) and
[Drizzle node-postgres support](https://orm.drizzle.team/docs/connect-node-postgres).

### Hyperdrive configuration

Worker database access requires the `HYPERDRIVE` binding in all three Wrangler configs.
Create separate staging and production configurations against their direct Neon primary endpoints,
with **query caching disabled** (`--caching-disabled` when creating/updating through Wrangler).
Cached reads would break auth revocation, configuration freshness, optimistic writes and receipt recovery.
Never point Hyperdrive at Neon's `-pooler` endpoint; Hyperdrive owns connection pooling.
Store each returned configuration ID in the corresponding Wrangler config before building/deploying.
`DATABASE_URL` remains a private input for Node migration/bootstrap scripts only; Workers never read it.
Local development requires both `DATABASE_URL` (migrations) and
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` (Worker queries) pointing at the same dev branch.
