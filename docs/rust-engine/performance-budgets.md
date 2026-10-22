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

Use synchronous JSON commands + bounded deltas after async preparation; retain
object path as measurement control until Phase 1.7. JSON won this benchmark.
No full history is returned per key; explicit log reads only.
Raw Wasm <=1 MiB, gzip <=300 KiB, glue <=32 KiB. Binding p95 <=0.1 ms/unit.
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
OXYTYPE_ENGINE_PROOF=true vp run --filter @oxytype/frontend build:start
ENGINE_PROOF_OUTPUT="$PWD/docs/rust-engine/candidate-proof.json" vp run --filter @oxytype/frontend benchmark-migration engine-proof.migration.ts
vp -C frontend test run --config vitest.start.config.ts __tests__/start/document.spec.ts
```

Generated declarations/Wasm/glue ignored; Vite bootstrap invokes pinned Cargo and
wasm-bindgen automatically. CI and production rebuilds use the same setup action.
Pinned candidate versions proven here: Rust 1.99.1, wasm-bindgen/CLI 0.2.129.
Rust MSRV declared 1.99; only pinned 1.99.1 tested so far.

