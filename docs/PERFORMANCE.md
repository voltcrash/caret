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
vp run --filter @caret/frontend build:start
CARET_PERFORMANCE_OUTPUT=/tmp/startup.json vp -C frontend exec playwright test --config playwright.migration.config.ts performance.migration.ts
WORD_RENDERING_BENCHMARK_OUTPUT=/tmp/words.json vp run --filter @caret/frontend benchmark-word-rendering
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


## Real first paint — October 29, 2026

The document includes actual test controls and words. There is no fullscreen
cover, blank settings bar or “Preparing typing test…” screen. Rust generates the
first-visit wordset during the build; serving it requires no database read,
authentication, runtime Wasm compilation or asset fetch. The browser reproduces
that seed when initializing its first session, preserving the visible words.

Ordinary time/word tests save a bounded, validated presentation snapshot in a
same-site cookie. Returning documents can render their last wordset, mode,
duration/count and appearance before application JavaScript downloads. The
snapshot's hash selects the seed only when the actual local engine configuration
and language asset match. Cookie words are never used as authoritative engine
input. The engine still generates and verifies its own content.

Saved maximum line width and keyboard visibility, layout, size and legends also
apply to the initial document. Keyboard layout data is bundled into the server;
rendering it needs no request-time asset fetch. Saving presentation settings
updates the preview immediately, including changes made on the Settings page.
The returning-visit browser test holds JavaScript and compares every word's
bounds and the keyboard's bounds across the handoff.

Custom text and provider/adaptive content are not copied into cookies. Unsupported
or invalid snapshots use the built-in first-visit content while local settings
initialize. Existing local settings that predate this feature also initialize
normally, then produce the preview for subsequent visits. The first-visit starter
wordset is shared for a build; subsequent tests retain random generation.

Saved theme/typography still apply before paint. The live test mounts invisibly
in the same layout cell, then takes over once its input is ready. Controls in the
initial HTML are presentation until that handoff. Authentication, account history,
announcements, optional chrome and offline installation remain deferred. Late
preferences and consent still wait for an idle test.

`start-e2e/first-paint.spec.ts` holds Wasm while checking visible actual words and
controls, then checks identical engine words and layout. A returning-visit check
holds all application JavaScript and verifies the saved wordset before and after
handoff. Startup, offline, navigation and touch tests retain their earlier checks.
The static no-JS/no-CSS recovery in `src/html/warnings.html` is unchanged.
