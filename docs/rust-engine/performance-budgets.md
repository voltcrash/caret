# Performance budgets — frozen before full port

Budgets: `performance-budgets.json`. Do not raise them to hide a failed migration.
Conditions: baseline.md; same Linux ARM64 machine, Desktop Chromium 153.0.8010.12,
no CPU/network throttle, local built Cloudflare Start/workerd. Shared host; allow
only the fixed additive margins below. CI timing is diagnostic until equivalently
controlled; structural/size/parity assertions remain mandatory everywhere.

## Early proof measured

- Actual browser through production Vite/Start/Cloudflare build: pass.
- Real keyboard finite test, deletion fixture, two isolated sessions, double disposal,
  stale access rejection, recreation, invalid-config recovery: pass.
- Wasm 484,654 raw bytes; gzip 110,209 bytes. MIME application/wasm; immutable asset headers.
- Module/glue fetch + initialization: 22.1 ms (one cold sample; not a p95 claim).
- JSON incremental boundary: median 0.005 ms, p95 0.006 ms per UTF-16 unit.
- Incremental object boundary: median 0.008 ms, p95 0.0095 ms. 50 measured batches,
  10 discarded warmup batches, 200 UTF-16 units/batch, identical shared core.
- Seven real input-to-double-rAF samples: maximum 36.1 ms. Full website/input soak
  regression is still Stage 2 work; this proof uses a minimal owned Solid component.
- Server JS bundle scan found no engine_bg, wasm_bindgen, WebAssembly, browser.client.
- CSP requires wasm-unsafe-eval. General JavaScript eval remains denied in production;
  nonce/static fallbacks unchanged. Workerd document policy: six tests pass.

## Chosen boundary and limits

Use synchronous JSON commands + bounded deltas after async preparation. JSON won the benchmark; the object-only measurement path is retired, with original evidence retained.
No full history is returned per key; explicit log reads only.
Raw Wasm <=1 MiB, gzip <=300 KiB, glue <=32 KiB. Binding p95 <=0.1 ms/unit.
Audit module (`typing-audit-wasm`: result replay, timing statistics, challenge
and funbox rules) is separate: raw <=512 KiB, gzip <=200 KiB. It never ships in
the typing payload or the offline precache; the Worker receives it precompiled
and the event log viewer and challenges fetch it on demand.
Initialization p95 <=100 ms (collect repeated cold samples at final gate).
Startup cold/warm median <=baseline+75 ms, p95 <=baseline+100 ms.
Input paint p95 <=baseline+5 ms. Restart median <=baseline+25 ms, p95 <=baseline+50 ms.
2,000-character active JS heap <=baseline+8 MiB; reset JS heap <=baseline+2 MiB;
retained Wasm linear memory after reset <=16 MiB. Keep JS and Wasm memory separate.
Longer soaks must demonstrate bounded growth per recorded event and no per-restart leak.

## Verification commands

```sh
vp run engine:test
vp run engine:fmt
vp run engine:lint
OXYTYPE_ENGINE_PROOF=true vp run --filter @caret/frontend build:start
ENGINE_PROOF_OUTPUT="$PWD/docs/rust-engine/candidate-proof.json" vp run --filter @caret/frontend benchmark-migration engine-proof.migration.ts
vp -C frontend test run --config vitest.start.config.ts __tests__/start/document.spec.ts
```

Generated declarations/Wasm/glue ignored; Vite bootstrap invokes pinned Cargo and
wasm-bindgen automatically. CI and production rebuilds use the same setup action.
Pinned candidate versions proven here: Rust 1.99.1, wasm-bindgen/CLI 0.2.129.
Rust MSRV declared 1.99; only pinned 1.99.1 tested so far.


## Completed engine checkpoint (e7b7ad864)

Actual Cloudflare build, same recorded host/browser; 24 browser cases pass with controlled timing gates enabled (46.8 s). Wasm is 755,466 raw / 301,279 gzip6 bytes, SHA256 `b564513a4cf0f1c4e5c07db96a647f5e5c8f54c150e6e411ea3babd7403ca8f2`. Deployed minified facade/glue is 13,540 bytes. Build/cache reuse enforce the frozen raw/gzip limits; browser proof also checks deployed facade size.

Thirty fresh contexts, HTTP cache disabled: initialization p95 45.1 ms. Fifty warmed boundary samples: p95 0.01050 ms/UTF-16 unit. Seven keyboard/double-rAF samples: maximum 36.7 ms (proof component, not full website baseline comparison). Baseline 2,000-unit reset retains 9,240,576 Wasm bytes; replacement range after warmup is zero. Long workload maximum block cost 0.02360 ms/unit; reset workload 0.02620.

The separate 20,000-unit workload/full-log export retains 81,395,712 bytes after reset; repeated owners remain flat. Wasm retains its high-water allocation. The frozen 16 MiB limit applies to the recorded 2,000-unit workload, not arbitrary explicit full-log sizes. Full website startup/input/restart/JS-heap comparison remains Stage 2.
