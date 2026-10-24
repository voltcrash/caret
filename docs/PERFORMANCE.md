# Performance improvements — October 2026

Baseline: `8429ba0fe`. Implementation: `a67a953c7`.
Raw measurements and environment: [evidence](performance/evidence/).

## Results

| Measurement | Before median | After median |
| --- | ---: | ---: |
| Cold desktop readiness | 1,031 ms | 400 ms |
| Cold mobile, 4× CPU, 150 ms latency, 200 KiB/s | 5,136 ms | 4,977 ms |
| Cold mobile, 6× CPU, 400 ms latency, 50 KiB/s | 17,601 ms | 17,125 ms |
| Letter-update CPU, 1,000-word test | 0.012 ms | 0.004 ms |
| Previous-word lookup, 90,000 events | 3.983 ms | <0.001 ms |

Startup: built Start Worker, guest, cold HTTP cache, service workers blocked,
three fresh Chromium contexts per profile. Readiness includes the startup fade;
each sample also verifies the first typed character. Desktop samples were noisy
(525–1,050 ms before; 373–519 ms after). Mobile profiles emulate CPU, touch,
viewport and network conditions; they do not replace physical-device testing.

Letter updates: existing browser benchmark, 50 measured samples after 10 warmups.
Its typing measurement excludes forced layout per keystroke; it is not an INP
measurement. Initial 1,000-word rendering stayed effectively unchanged
(68.5 → 69.1 ms median). Previous-word lookup: Node benchmark, 5,000 words,
90,000 events, 50 measured reads after 10 warmups, with event-cache invalidation
between reads.

Slow-network startup remains bandwidth bound: about 1.04 MB of decoded JavaScript
and 77 script requests in the final fixture. Decoded bytes are not compressed
transfer size. The 4G/3G gains are modest; these local results are not production
latency guarantees. Service-worker installation is excluded from this timing
comparison and verified separately by browser tests.

## Changes

- Update existing letter nodes; preserve Unicode, IME, hints and funbox rendering.
- Cache at most 32 word-element lookups per app; invalidate detached words and
  clear on restart/unmount.
- Index the latest input event per word. Preserve timestamp/tie ordering,
  last-word commit handling, cleanup and reset behavior.
- Start browser/typing downloads during Router hydration. Preload the verified
  default English list from the typing document. Non-English preferences still
  load their own list; their first visit also downloads the small English preload.
- Read font storage and language metadata concurrently, after preferences settle.
  Apply bulk preference changes once and batch their reactive updates.
- Load result completion/retry code on demand. Warm completion while typing;
  stop the timer synchronously before loading code or animating. Keep completion
  in the offline precache.
- Register the service worker after startup finishes; cap precache downloads at
  four concurrent requests. Preserve the complete offline shell and update rules.

The startup logo, readiness gates, skeletons and static no-JS/no-CSS fallbacks
remain intact.

## Reproduce

Run the same benchmark files on the baseline and implementation. These scripts
are added by this PR; copy them into a baseline checkout before measuring it.

```sh
vp run --filter @oxytype/frontend build:start
OXYTYPE_PERFORMANCE_OUTPUT=/tmp/startup.json vp -C frontend exec playwright test --config playwright.migration.config.ts performance.migration.ts
WORD_RENDERING_BENCHMARK_OUTPUT=/tmp/words.json vp run --filter @oxytype/frontend benchmark-word-rendering
vp -C frontend exec vpx ./scripts/measure-input-snapshots.ts /tmp/input.json
```

Run benchmarks sequentially, without other builds/tests competing for CPU.
Chromium must be installed through the repository's Playwright workflow.
No timing thresholds were added to CI.

## Validation

- 2,421 frontend unit tests; 657 shared-package tests.
- 147 browser regressions, including touch/IME, responsive layouts, settings,
  result persistence, authentication, skeletons and restart behavior.
- Final startup/offline rerun: 8 browser tests; 94 Worker/SSR tests.
- Three multi-build update/rollback tests, including a pending real save and a
  removed server function.
- Production/runtime-test builds, import boundaries, type-aware lint and format
  checks.
