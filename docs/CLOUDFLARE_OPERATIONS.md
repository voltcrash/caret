# Cloudflare operations

For local contributors and maintainers operating Oxytype staging and production.

Backend runtime: one Worker, D1 and Cron. Node is used for builds only.
Local workerd uses local D1 without a Cloudflare login.
The [production setup](PRODUCTION_SETUP.md) uses an isolated database and
`frontend/wrangler.production.json`.

## Local development

```sh
vp install --frozen-lockfile
vp exec cp frontend/.dev.vars.example frontend/.dev.vars
vp run --filter @oxytype/frontend db:migrate
vp run dev
```

Start serves document, assets, functions and /api at http://localhost:3000.
Wrangler persists local D1 in `backend/.wrangler`; local and remote migrations
are separate commands. Result/telemetry validation runs in development and production;
never copy the development secret/test captcha key into a production deployment.
Use `.dev.vars` for Worker settings, not Node `.env`.

Google/GitHub social sign-in needs a provider's backend-only client ID/secret.
Register `BETTER_AUTH_URL/callback/google` or `/github`; local URL is
`http://localhost:3000/api/auth`. Email/password/reset flows stay disabled.
Signup defaults disabled in BASE_CONFIGURATION; enable deliberately
through the admin configuration contract/D1, not by weakening guards. XP, the
weekly XP leaderboard and daily leaderboards (English time 15/60) default
enabled.

Verification:

```sh
vp lint --type-aware --type-check --format agent backend
vp run --filter @oxytype/backend test
vp run --filter @oxytype/backend integration-test
vp -C backend test run __tests__/d1/http.spec.ts
vp run --filter @oxytype/frontend test:start
```

Start generates retained API docs and uses curated frontend/static assets.
Private backend editor/config assets never enter the public asset directory.
The D1 suite runs actual SQLite in workerd through the same backend handlers
Start mounts under `/api`.

## Staging deployment

Dedicated account: Lakshmi Tanmay, `eb2679ce4f23ae7db4e6c4e3fcf8c3c1`.
Worker: [oxytype-api-staging](https://oxytype-api-staging.voltcrash.workers.dev).
Auth URL: `https://oxytype-api-staging.voltcrash.workers.dev/api/auth`. D1: `oxytype-staging`,
`17b0ae8b-92bf-4d7e-a29e-0ac4cc6f2b59`, APAC placement hint.
Start delivery uses frontend/wrangler.staging.json; production uses its separate
frontend/wrangler.production.json. Preserve existing remote auth/OAuth secrets.

```sh
vp run --filter @oxytype/frontend build:staging-site
vp run --filter @oxytype/frontend db:migrate:staging
vp run --filter @oxytype/frontend deploy:staging-site
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
  repository and quote. Restrict repository/origin to deployment-owned Oxytype
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
(`oxytype_requests` production, `oxytype_staging_requests` staging).
Columns are append-only:

| Column | Value |
| --- | --- |
| `index1`, `blob1` | Operation ID, or route kind for documents/multi-op calls |
| `blob2`–`blob5` | Kind, method, status, edge cache `hit`/`miss` |
| `blob6`, `blob7` | Release, build |
| `double1`–`double4` | Duration ms, status, D1 statements, operations |

p95 latency per operation over the last hour (SQL API):

```sql
SELECT blob1 AS operation,
  quantileExactWeighted(0.95)(double1, _sample_interval) AS p95_ms,
  sum(_sample_interval * double3) / sum(_sample_interval) AS d1_per_request
FROM oxytype_requests
WHERE timestamp > NOW() - INTERVAL '1' HOUR
GROUP BY operation ORDER BY p95_ms DESC
```

## Database capacity and recovery

### Read replication

Both deployment commands enable D1 global read replication (`mode: auto`)
and verify the database identity and persisted setting before uploading the
Worker. This includes automatic production releases. The operation is
idempotent and reads the `DB` binding from the matching Wrangler config.
The deployment token needs D1 read/edit permissions. Missing credentials,
API errors or failed verification stop deployment.

To enable or verify independently with `CLOUDFLARE_API_TOKEN` configured:

```sh
vp run --filter @oxytype/frontend db:replication:staging
vp run --filter @oxytype/frontend db:replication:production
vp exec wrangler d1 info oxytype-production --config frontend/wrangler.production.json --json
```

No schema migration is needed. Enabling the database setting alone does not
route existing non-session queries to replicas: deploy the session-enabled
Worker too. All application Drizzle queries, raw SQL and atomic batches share
one session per fetch/Cron invocation. `first-primary` establishes a fresh
baseline, then replicas may handle subsequent reads without losing that
invocation's writes. A new invocation starts fresh on the primary; no client
bookmark storage or cookie is required. Single-query invocations still use
the primary. Auth checks and optimistic mutation snapshots always read the
primary, including retries after a failed version guard.

Cloudflare manages replica locations. Writes still run on the primary, so
replication improves read latency/throughput, not write capacity. Replicas
have no additional storage/compute charge beyond normal D1 query billing.
Local Miniflare tests cover session routing and consistency plumbing; they
do not simulate remote replica lag or prove geographic latency improvements.

After deployment, inspect D1 dashboard metrics by serving region. Raw D1
results expose `meta.served_by_region` and `meta.served_by_primary`; these
are undefined locally. Confirm replica traffic under a multi-query workload.

To roll back routing, disable Read Replication in the database's Cloudflare
Settings (`read_replication.mode: disabled` via API). Cloudflare says stopping
replica traffic can take up to 24 hours. Sessions continue working with
replication disabled. Deployment commands re-enable replication, so remove
their `db:replication:*` steps before deploying a lasting disablement.

Reference: [Cloudflare global read replication](https://developers.cloudflare.com/d1/best-practices/read-replication/).

### Capacity and migrations

Migration commands now run `PRAGMA optimize` only after successful migrations,
on the same local persistence directory or configured remote database. This
updates SQLite planner statistics when needed, including after new indexes.
It does not run on the request path or during deployment dry runs. To run it
independently:

```sh
vp run --filter @oxytype/frontend db:optimize
vp run --filter @oxytype/frontend db:optimize:staging
vp run --filter @oxytype/frontend db:optimize:production
```

### Query Insights reports

The `D1 Query Insights` Actions workflow runs daily at 06:23 UTC on main and
supports manual dispatch from main. It collects the last 24 hours for production
and staging, ranked separately by total execution time, average execution time,
rows read and rows written (top 20 per category). View each job's summary or its
30-day JSON/Markdown artifacts. Collection failures fail the job; queries above
advisory thresholds produce warnings rather than blocking deployments.

Thresholds in `frontend/scripts/d1-query-insights.ts`: at least 10 executions,
then average duration >=50 ms or average rows read >=1,000. A high row count is
a review candidate, not proof of a missing index. Use `EXPLAIN QUERY PLAN` on
the identified query before changing indexes. Metrics are sampled; ranked
lists are not complete database totals and can overlap.

The workflow uses the existing production environment's `CLOUDFLARE_API_TOKEN`;
it needs D1 read and account Analytics read access. Production environment
approval rules, if configured, also apply to these reporting jobs. It never
deploys, changes schema or writes application data.

```sh
vp run --filter @oxytype/frontend db:insights:production
vp run --filter @oxytype/frontend db:insights:staging
```

Local reports go to ignored `frontend/.reports/d1/`. Persisted reports and
Actions logs contain SHA-256 query IDs and metrics, not captured SQL or literal
values. For investigation, use Wrangler Insights locally, hash the exact
captured SQL to match a report ID, then inspect the query plan. Cloudflare's
query capture excludes bound parameters; SQL containing literal values can
still be sensitive. Do not publish raw Wrangler output as an artifact.

Reference: [D1 metrics and Insights](https://developers.cloudflare.com/d1/observability/metrics-analytics/).

### Transient write failures

Migration `0016_write_receipts.sql` adds an indexed receipt table. Apply it
before deploying the new Worker through the normal migration command.
Atomic user/result batches, account deletion batches, leaderboard publication
and scheduled cleanup use receipt-protected commits. Each prepared batch gets
one random receipt inserted in the same transaction as all its effects.

Retryable connection/reset failures trigger a primary-routed receipt probe.
An existing receipt proves the entire batch committed. Otherwise the same
prepared batch can replay; its unique receipt prevents a delayed original
commit from causing duplicate effects. The probe uses a no-op write so it also
advances the request session's bookmark after a lost acknowledgement. Application
callbacks are not repeated for transport retries. Existing optimistic version
conflict handling still rebuilds a draft from the primary.

Retries are limited to three retries/four attempts with exponential full jitter
(100/200/400 ms caps). Recovery probes have the same retry bound. Only Cloudflare's
documented connection-lost and object-reset messages qualify; constraint,
capacity, overload and other errors propagate. Receipts add a row and index
write per batch and expire through hourly cleanup after seven days. No user
payloads are stored in receipts.

This is internal batch replay protection, not cross-request idempotency.
Result submission hashes still handle client resubmissions. Standalone rate
counter increments and Better Auth writes are not blindly retried; they lack
this batch receipt. D1 already retries eligible read-only queries itself.

Reference: [D1 retry guidance](https://developers.cloudflare.com/d1/best-practices/retry-queries/).

### Production Smart Placement

`frontend/wrangler.production.json` enables `placement.mode: smart` directly
on the production Worker. Staging and local placement stay unchanged. Deploy
the production Worker normally; no performance experiment or staging promotion
is required. Cloudflare learns from traffic and chooses locations when moving
execution is expected to improve overall request duration. Learning can take
up to 15 minutes and needs consistent traffic from multiple locations.

Production request logs include `placementMode: smart` and a validated
`placement` value from Cloudflare's `cf-placement` header when available
(`local-BOM`, `remote-SIN`, etc.). Responses expose that validated value as
`X-Oxytype-Placement`. Missing values mean unreported placement. Logs' `durationMs`
measure Worker handling, not full forwarding latency; use Cloudflare's request
duration analytics for total request performance. Placement does not change
D1's primary/replica consistency rules, move static assets served directly by
Cloudflare, or relocate Cron handlers.

Build artifact checks reject a placement mode that differs from source config.
To disable placement later, remove production's `placement` and `PLACEMENT_MODE`
settings, rebuild and redeploy. Database replication is independent.

Reference: [Workers Smart Placement](https://developers.cloudflare.com/workers/configuration/placement/).

### Capacity and recovery

Measure DB+indexes against the account tier and projected growth; benchmark
result saves and ranking reads/rebuilds. Large
history may need external SQL, partitioning or R2 archival.

Back up the database and pause writes before schema changes. A code
rollback that requires an older schema also requires a matching database restore.
Migration `0014_remove_inbox.sql` drops inbox, reward grant, outbox and scheduled
job tables and removes inbox fields from user data and configuration. Pending
notifications and unclaimed rewards are discarded when it is applied.

Migration `0015_remove_ape_keys.sql` permanently deletes stored external API
keys and removes their configuration, user permissions and rate counters.
Back up D1 before applying it through the normal migration command. Old key
headers return 401 and key-management routes return 404. Browser OAuth accounts,
sessions, typing results and unrelated legacy tables are retained.

After this migration, rolling back to code that queries the removed table also
requires a compatible database restore. A Worker-only rollback cannot restore
deleted credentials. No API-key audit or restoration command remains.

Migration `0017_daily_summary_index.sql` adds a covering expression index for
the daily leaderboard summary. It is additive; older Workers ignore it.
