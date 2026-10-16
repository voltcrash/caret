# Cloudflare operations

For local contributors and maintainers operating Oxytype staging and production.

Backend runtime: one Worker, D1, Queues and Cron. Node is used for builds only.
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
Signup and inbox default disabled in BASE_CONFIGURATION; enable deliberately
through the admin configuration contract/D1, not by weakening guards. XP, the
weekly XP leaderboard and daily leaderboards (English time 15/60) default
enabled. Daily XP rewards for the top 100 are mailed only once the inbox is on.

Verification:

```sh
vp lint --type-aware --type-check --format agent backend
vp run --filter @oxytype/backend test
vp run --filter @oxytype/backend integration-test
vp -C backend test run __tests__/d1/http.spec.ts
vp run build-be
```

Start generates retained API docs and uses curated frontend/static assets.
Private backend editor/config assets never enter the public asset directory. The D1 suite runs actual SQLite in workerd; unit tests preserve
controller/HTTP contracts.

## Staging deployment

Dedicated account: Lakshmi Tanmay, `eb2679ce4f23ae7db4e6c4e3fcf8c3c1`.
Worker: [oxytype-api-staging](https://oxytype-api-staging.voltcrash.workers.dev).
Auth URL: `https://oxytype-api-staging.voltcrash.workers.dev/api/auth`. D1: `oxytype-staging`,
`17b0ae8b-92bf-4d7e-a29e-0ac4cc6f2b59`, APAC placement hint.
Queues: `oxytype-staging-tasks` and `oxytype-staging-dlq`.
Start delivery uses frontend/wrangler.staging.json; production uses its separate
frontend/wrangler.production.json. Preserve existing remote auth/OAuth secrets.
The rollback Hono build remains a validation target until Stage 8.

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

Missing integrations return explicit 503 or retain queued deliveries for retry.
A bridge implementation and OAuth provider credentials are not supplied here.

## Queue/Cron recovery

Cron runs every minute: sends at most 10 outbox IDs and 10 due job IDs. Uncompleted
outbox rows are rediscovered after 15 minutes. Scheduled jobs use leases, SQL due
timestamps and at most 23 processing attempts; Queues adds retry/DLQ delivery.
Queue concurrency and batch size are one. Rewards process pages of 20, with
stable period/user mail IDs and unique D1 claims. Quote publication requires bridge
idempotency; Queues itself is not exactly once.

Every 15 minutes rebuild indexed all-time snapshots/histograms; hourly purge
expired auth records/counters, 30-day nonimportant audits and 90-day completed
outbox rows. Expired period rows remain while their payout jobs are unfinished,
including failed jobs. Important audits, results and completed scheduler IDs
have no automatic deletion policy; monitor their growth.

Inspect `scheduled_jobs` status/attempts/lease and unfinished `outbox` rows;
monitor Cloudflare queue backlog/DLQ and Workers logs. Resolve the cause before
replaying a failed job. For a reviewed job ID, reset status to `pending`, attempts
and lease to zero; Cron rediscovers it. Reward IDs still deduplicate. Replaying
outbox rows requires preserving reward identities and deduplication claims.
No automatic DLQ consumer silently discards failures.

## Database capacity and recovery

Measure DB+indexes against the account tier and projected growth; benchmark
result saves, exact rate counters and ranking reads/rebuilds. Large
history may need external SQL, partitioning or R2 archival.

Back up the database and pause writes/consumers before schema changes. A code
rollback that requires an older schema also requires a matching database restore.

## ApeKey hash compatibility

ApeKeys use `sha256:` followed by 64 lowercase hexadecimal characters. The Worker
rejects unsupported formats and compares digests in constant time.

Before deploying to a retained database or restoring older data, run these
read-only audits. They include disabled keys and output counts only:

```sh
vp run --filter @oxytype/backend db:audit-ape-key-hashes
vp run --filter @oxytype/backend db:audit-ape-key-hashes:production
```

`unsupported_hashes` must be zero. Replace affected keys before accepting API-key
requests; unsupported hashes cannot be converted without the original key.
Better Auth accounts and sessions use separate authentication.
