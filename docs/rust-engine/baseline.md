# Website baseline

Source engine: `7b1ae05f204be53b5d9f2714f21c6eea08b25935`. No rule changes.

Host: Linux aarch64, 7.1.13-402.asahi.fc44.aarch64+16k; Node 24.21.0.
Browser: bundled Playwright Chromium 153.0.8010.12, Desktop Chrome profile.
No CPU/network throttle. Shared development machine; no exclusive CPU reservation.
Cloudflare Vite + TanStack Start production bundle, local Miniflare/workerd, seeded D1.
Browser HTTP cache cold/warm as described in readiness fixture; service worker bypassed.

| Measurement (ms) | Samples | Median | p95 |
| --- | --- | --- | --- |
| cold | 10 | 745.90 | 1400.60 |
| warm | 10 | 644.70 | 744.40 |
| settings | 10 | 519.30 | 716.50 |
| inputToPaint | 20 | 78.10 | 107.50 |
| restart | 20 | 423.50 | 451.59 |

Readiness includes navigation → first accepted input/render, so measures usable test,
not only bundle initialization. Input-to-paint is a conservative double-rAF proxy
including Playwright assertion latency. Restart includes click + complete fade.
Raw samples are adjacent JSON, not replaced by summary numbers.

Forced-GC JS heap: initial 8,628,096 B; active after 2,000 keyboard chars 13,696,236 B; after reset 13,135,484 B.
Recorded JS/Wasm decoded resource bytes: 1,717,897 B (resource list in JSON; repeated URLs count repeated loads).
This bounds one 1,000-word zen run; longer soak verification still required at 1.7/2.5.

## Reproduce

```sh
vp install --frozen-lockfile
vp run --filter @oxytype/frontend build:start
MIGRATION_BASELINE_OUTPUT="$PWD/docs/rust-engine/candidate-readiness.json" ENGINE_PERFORMANCE_OUTPUT="$PWD/docs/rust-engine/candidate-input.json" vp run --filter @oxytype/frontend benchmark-migration readiness.migration.ts engine-performance.migration.ts
```

The fixture server expects `dist/start`, not the `dist/start-test` runtime-entry build.
Initial attempt used the latter and failed ENOENT before browser work; corrected by
building `build:start`. Both build paths passed; production path browser tests passed.

## Existing regression evidence

- Core: 28 files / 349 tests passed.
- Frontend typing runtime: 27 files / 475 tests passed.
- Frontend input: 9 files / 204 tests passed.
- Browser baseline: 2 tests passed (53.4 s).
- Baseline benchmark type-aware lint passed.
- Production build emits pre-existing CSS sourcemap warning; build exits 0.

