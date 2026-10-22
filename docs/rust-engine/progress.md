# Rust engine migration progress

Implementation owner: sole agent; no delegation.
Starting commit: `7b1ae05f204be53b5d9f2714f21c6eea08b25935`.
Branch: `t3/rust-engine-migration`. Initial working tree clean.

## Delivery

Three PRs, stacked: Stage 1 engine → Stage 2 website → Stage 3 terminal.
Small commits at coherent behavior/build/documentation boundaries. Do not create
empty commits to inflate count. Do not publish production or releases implicitly.

## Current position

Stage 1, Phases 1.1–1.3 complete; Phase 1.4 in progress. Read root AGENTS.md and the complete migration
plan before edits. Installed workspace dependencies with frozen lockfile.
Phase 1.1 and 1.2 gates passed: inventory/baselines, lossless contract, frozen oracle and mismatch detection. Existing website engine remains authoritative.

| Phase | Status | Evidence / remaining gate |
| --- | --- | --- |
| 1.1 Inventory / baselines | Complete | See inventory.md, features.md, baseline.md and raw measurements. |
| 1.2 Contracts / fixtures | Complete | 13 command traces, 15 oracle/integrity tests; contract and classified gaps. |
| 1.3 Native / browser proof | Complete | Native 7 traces; Cloudflare real-browser finite slice; MIME/CSP, lifecycle, boundary benchmark. Budgets frozen. |
| 1.4 Input / lifecycle / timing | Active | Remaining input penalties, code, physical observations, browser differences and timing. |
| 1.5 Generation / configuration | Pending | Requires contract and proof. |
| 1.6 Events / results / replay | Pending | Requires input and generation. |
| 1.7 Binding / engine gate | Pending | Full three-path parity and budgets. |
| 2.1–2.6 Website | Pending | Requires Stage 1 gate. |
| 3.1–3.5 Terminal | Pending | Requires Stage 2 gate. |

## Verification log

- `vp install --frozen-lockfile`: pass; 1,102 packages, lockfile unchanged.
- `vp test run --project=@oxytype/typing-core`: pass; 349 tests, 28 files.
- Environment: Linux, Node 24.21.0; installed Rust 1.99.1; GitHub CLI authenticated.
  Toolchain/binding pins not yet selected. Browser/OS support unverified.

- Phase 1.2: `vp test run packages/typing-core/__test__/rust-oracle.spec.ts`: 15 pass.
- Phase 1.2 type-aware lint: pass. Capture created new traces once, refuses overwrite.
- `vp exec rustup target add wasm32-unknown-unknown`: pass.

- Phase 1.3: `vp run engine:test`: three native tests pass (seven frozen traces).
- Phase 1.3: `vp run engine:lint` and `vp run engine:fmt`: pass.
- Phase 1.3: opted-in Cloudflare production build and browser proof: pass.
- Phase 1.3: workerd document suite: six pass; production CSP now permits Wasm compilation specifically.
- Phase 1.3: boundary benchmark/type-aware lint passed; proof-performance.json and performance-budgets.md record limits and evidence.
- Early failed browser proof correctly exposed CSP; fixed and retested. Initial build raced workspace dependency installation; reran after install completed.

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
