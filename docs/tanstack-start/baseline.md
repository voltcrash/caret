# Phase 0.2: measured baseline and gates

Captured 2026-10-15 on the unchanged legacy application source from `d6e5be3e9`.
Production frontend artifact identifies `b698260fd` (only inventory/docs changes
since baseline). No Start dependency/runtime change precedes these measurements.
[Environment and artifact/config hashes](evidence/environment.json),
[command results](evidence/validation.json), [raw measurements](evidence/measurements.json)
and [frozen budgets](evidence/budgets.json) are versioned evidence.

Environment: Darwin arm64, Apple M1, 8 GiB; vp 1.0.0/Node 24.21.0;
Playwright 1.63.0 desktop Chromium; Miniflare 5.20261001.0-alpha,
Wrangler 4.146.0, compatibility date 2026-10-02. No CPU/network throttling.
Tests/builds run before measurements. Word runs are sequential; worker/readiness
capture briefly overlapped, so observed variance includes that local contention.
Repeat on this host/fixture; do not compare remote-network timings to these gates.

| Timing (ms) | Samples | Median | p95 | Median / p95 maximum |
| --- | --- | --- | --- | --- |
| Cold input verified | 10 | 405.70 | 788.10 | 788.10 / 1170.50 |
| Warm input verified | 10 | 370.30 | 427.30 | 427.30 / 484.30 |
| Public `/about` content | 10 | 332.30 | 350.60 | 365.53 / 383.83 |
| Local workerd process ready | 5 | 202.69 | 389.32 | 389.32 / 575.94 |
| Actual result-save round trip | 50 | 12.80 | 29.13 | 29.13 / 45.45 |
| Local workerd CPU/public read | 5 batches of 50 | 6.80 | 6.80 | 7.48 / 7.48 |
| 1,000-word DOM render | 150 | 53.60 | 85.20 | 85.20 / 116.80 |
| 1,000-word render + layout | 150 | 53.60 | 85.20 | 85.20 / 116.80 |
| Word-letter update | 150 batches of 100 | 0.010 | 0.012 | 0.012 / 0.014 |

| Deterministic count/size | Baseline / maximum |
| --- | --- |
| Eager production JS (63 entry/preload responses) | 922,918 raw / 321,462 gzip bytes |
| Worker bundle | 4,517,181 raw / 822,854 gzip bytes |
| D1 configuration read | 4 statements |
| D1 public typing stats | 6 statements |
| D1 account read | 19 statements |
| D1 history read (0 or 10 rows) | 7 statements |
| D1 result save | median 18 / p95 20 statements (first PB/streak costs more) |

Budgets use nearest-rank median/p95. Timing margin is
`max(p95 - median, median * 0.10)`, added to both statistics. This preserves
observed variance, including cold-start outliers, before framework changes.
Byte/count gates allow no increase. These are local comparison gates, not a
promise of edge latency or a replacement for browser input profiling.
Explain regressions at the owning phase; never silently regenerate budgets to pass.

Measurement definitions/limits:

- `measure-eager-js`: five identical measurements of one production artifact;
  entry scripts and explicit preloads, each independently gzipped. This excludes
  lazy chunks, SW files, sourcemaps and unrequested JS. Repeated deterministic
  reads prove measurement stability, not independent build variance.
- `readiness.migration.ts`: built/minified assets served by Vite preview; guest
  API fixtures live on the server, preserving HTTP cache. Cold disables HTTP
  cache; warm enables it; both bypass SW. Navigation-to-correct-first-letter
  includes document load, shell/startup fade, focus/click and Playwright polling.
  `/about` measures visible public content, not full chart/font/network idle.
  Not a real OAuth, network, offline, or authenticated-history latency benchmark.
- Existing word benchmark: 1,000 words/12,000 letters, 10 warmups + 50 retained
  samples per run, three runs. Each typing sample averages 100 letter updates.
  Its synchronous rAF replacement measures rendering work, not end-to-end
  keystroke latency. Existing renderer flushes layout, hence equal DOM/layout
  values here. Raw arrays are sorted by the original summarizer; not chronological.
- `migration-baseline.ts`: executes the built Worker **inside workerd**, with
  fresh real local D1 per instance, existing migrations, production policy mode,
  local-only auth secret and one real server-created session. Setup seeds an old
  enough account. Ten hashed, valid results per instance are submitted normally;
  all 50 persist. Between submissions fixture timestamps are backdated as in
  existing D1 tests to avoid waiting 15 seconds per save. No server validation
  bypass is added. Local fixture setup is outside save timings/query counts.
- A test-only entry wraps D1 statement execution and adds a count header; it is
  never deployed. Counts include auth/config/rate/audit/business SQL; batch
  statements count individually. Exclude fixture setup and SQLite internal SQL.
- Startup is Miniflare construction → `ready` (process/runtime/module setup),
  excluding D1 migration/seed time; **not Cloudflare deployment startup CPU**.
  CPU is workerd process CPU from `ps time` deltas divided by 50 public requests;
  10ms counter granularity, includes local D1/runtime, excludes Node controller.
  It is **not per-request Cloudflare CPU telemetry**. Stage 7 must collect edge
  CPU/startup/latency on staging with representative data before release. Local
  figures establish a reproducible Stage 0 environment, without production access.

## Validation

- Web: 205 files / 2,225 tests pass. Additional budget tests: 4 pass.
- Backend: 44 unit files / 801 tests pass (includes 3 inventory guards);
  30 real-D1 files / 124 tests pass. Existing backend suites include historical
  client partitions; no TUI build/source/acceptance work was undertaken.
- Shared: seven workspaces, 54 files / 636 tests pass.
- Browser: existing 30 checks pass; new navigate-away/back characterization
  passes separately; production readiness passes; rendering passes all three runs.
- Frontend production fixture build and backend docs/assets/Worker dry-run pass.
  Frontend/backend/shared lint + typecheck pass, using agent format. Inventory
  freshness, frozen-budget comparison, unused-code/dependency analysis (`vp run knip`),
  changed-file formatting, local Markdown links and whitespace checks pass. Empty
  eager asset graphs now fail explicitly; the negative fixture and actual artifact
  were checked after the guard change.
- No pre-existing test failure was observed. Existing warnings: duplicated Solid
  test plugins, deprecated Vitest optimizer config, jsdom navigation, module-owned
  Solid roots/cleanups, Node module-type and NO_COLOR warnings. Not migration
  regressions; ownership cleanup belongs to Stage 2.
- Initial unconfigured production build/preview refused missing Turnstile key.
  Retried with documented public test key for local fixtures, preserving production
  fail-closed validation. Temporary harness typing/fixture failures were fixed;
  none remains unresolved. A real production deployment/dry-run with private
  credentials and real Turnstile site key is Stage 7, not a Stage 0 artifact.

## Reproduce

Run in an idle checkout; serialize browser commands (port 4173), and builds
(shared output). Never overwrite `evidence/budgets.json` for a candidate run.

```sh
vp install --frozen-lockfile
vp run test-fe
vp run test-be
vp run test-pkg
vp run test-e2e
vp run lint-fe
vp run lint-be
vp run lint-pkg
vp exec env TURNSTILE_SITE_KEY=1x00000000000000000000AA BACKEND_URL=/api AUTH_PROVIDERS=github vp run --no-cache build-fe
vp run build-be
vp run --filter @oxytype/frontend measure-eager-js
vp exec env MIGRATION_BASELINE_OUTPUT=/tmp/readiness.json vp run --filter @oxytype/frontend benchmark-migration
vp run --filter @oxytype/backend benchmark-migration /tmp/worker.json
vp exec env WORD_RENDERING_BENCHMARK_OUTPUT=/tmp/word1.json vp run --filter @oxytype/frontend benchmark-word-rendering
# Repeat rendering with word2.json and word3.json; each run retains 50 samples.
vp run --filter @oxytype/backend migration-inventory --check
vp -C frontend test run __tests__/utils/migration-performance.spec.ts
vp -C backend test run __tests__/migration-inventory.spec.ts
vp run --filter @oxytype/frontend migration-performance check ../docs/tanstack-start/evidence/budgets.json ../docs/tanstack-start/evidence/measurements.json
```

For candidate comparisons, assemble a measurements JSON with the same metric
keys as `evidence/measurements.json`: readiness `cold/warm/about`, Worker
`startup/save/cpuMsPerPublicRead/queries`, concatenated rendering `raw` arrays,
and five repeated byte/count measurements. Pass that candidate path to `check`.
Missing metrics, fewer than five samples, negative/non-finite values and exceeded
median/p95 gates fail. A framework output-path change must update eager asset
discovery before comparison; an empty/partial graph is not a valid improvement.
