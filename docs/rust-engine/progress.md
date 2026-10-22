# Rust engine migration progress

Implementation owner: sole agent; no delegation.
Starting commit: `7b1ae05f204be53b5d9f2714f21c6eea08b25935`.
Branch: `t3/rust-engine-migration`. Initial working tree clean.

## Delivery

Three PRs, stacked: Stage 1 engine → Stage 2 website → Stage 3 terminal.
Small commits at coherent behavior/build/documentation boundaries. Do not create
empty commits to inflate count. Do not publish production or releases implicitly.

## Current position

Stage 1, Phases 1.1–1.3 complete; Phases 1.4–1.6 active; full engine gate remains open. Read root AGENTS.md and the complete migration
plan before edits. Installed workspace dependencies with frozen lockfile.
Phase 1.1 and 1.2 gates passed: inventory/baselines, lossless contract, frozen oracle and mismatch detection. Existing website engine remains authoritative.

| Phase | Status | Evidence / remaining gate |
| --- | --- | --- |
| 1.1 Inventory / baselines | Complete | See inventory.md, features.md, baseline.md and raw measurements. |
| 1.2 Contracts / fixtures | Complete | 19 command traces, 21 oracle/integrity tests; contract and classified gaps. |
| 1.3 Native / browser proof | Complete | Native 7 traces; Cloudflare real-browser finite slice; MIME/CSP, lifecycle, boundary benchmark. Budgets frozen. |
| 1.4 Input / lifecycle / timing | Active | 19 native/browser command traces; 8 original recordings. Composition, batch failure, deferred work, visible-word bounds and browser deletion observations covered. Full generator/session integration remains open. |
| 1.5 Generation / configuration | Active | 48/61 unchanged generator snapshots. Quote and remaining funboxes pending. |
| 1.6 Events / results / replay | Active | All computed summary fields match 8 original CompletedEvents exactly. Full results, eligibility, replay pending. |
| 1.7 Binding / engine gate | Pending | Full three-path parity and budgets. |
| 2.1–2.6 Website | Pending | Requires Stage 1 gate. |
| 3.1–3.5 Terminal | Pending | Requires Stage 2 gate. |

## Verification log

- `vp install --frozen-lockfile`: pass; 1,102 packages, lockfile unchanged.
- `vp test run --project=@oxytype/typing-core`: pass; 349 tests, 28 files.
- Environment: Linux, Node 24.21.0; installed Rust 1.99.1; GitHub CLI authenticated.
  Pins: Rust 1.99.1, wasm-bindgen 0.2.129. Full browser/OS matrix pending.

- Phase 1.2: `vp test run packages/typing-core/__test__/rust-oracle.spec.ts`: 15 pass.
- Phase 1.2 type-aware lint: pass. Capture created new traces once, refuses overwrite.
- `vp exec rustup target add wasm32-unknown-unknown`: pass.

- Phase 1.3: `vp run engine:test`: three native tests pass (seven frozen traces).
- Phase 1.3: `vp run engine:lint` and `vp run engine:fmt`: pass.
- Phase 1.3: opted-in Cloudflare production build and browser proof: pass.
- Phase 1.3: workerd document suite: six pass; production CSP now permits Wasm compilation specifically.
- Phase 1.3: boundary benchmark/type-aware lint passed; proof-performance.json and performance-budgets.md record limits and evidence.
- Early failed browser proof correctly exposed CSP; fixed and retested. Initial build raced workspace dependency installation; reran after install completed.

- Phase 1.4 partial: native input logs match all eight original browser recordings. All 14 command traces (including physical repeat/NoCode/estimated cleanup) match intermediate frames.
- Native Clippy passes. Pure event statistics are being ported as prerequisites for min-speed/min-burst timing rules; full result gate remains pending.

## Decisions

- User's three-stage PR structure overrides the plan's suggested per-phase PRs.
- Browser rendering constraints (visible previous word, overflow) must be explicit
  host observations; Rust decides their rule effects. They cannot be discarded
  merely because headless TestSession does not model them.
- Preserve frozen snapshots. Record discrepancies; never regenerate to pass.

## Blockers

None established. Missing verification is pending work, not a passed gate.

## Resume

Read this file, inventory, contract, decisions, then `vp exec git status --short`.
Continue the first incomplete gate. Record commands and actual outcomes here;
do not rerun completed checks without a new reason.

## Latest implementation evidence

- Native and actual Cloudflare-browser Wasm match all 19 frozen command traces.
- Original CompletedEvent summaries match exactly (including floating-point outputs); exhaustive Hangul compatibility hash covers all 65,536 UTF-16 units.
- Pace, weak-spot learning, explicit Mulberry32/strict random streams, 99 frozen transform cases, language punctuation, lazy mode and British conversion implemented.
- Native generator currently matches 48/61 original snapshots; unsupported cases remain explicitly skipped and prevent the full Stage 1 gate.
- Native test, Clippy and format checks passed after language-rule integration. Final current-head browser/build rerun pending.
- Draft Stage 1 PR: https://github.com/voltcrash/oxytype/pull/184. Initial CI native/Wasm, SSR, delivery and frontend checks passed; package routing failure fixed locally (60 routing tests pass). Whole current-head CI not yet verified.
- Stages 2 and 3 have no implementation yet. No production deployment or release published.
