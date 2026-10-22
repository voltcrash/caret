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
| 1.5 Generation / configuration | Active | 61/61 unchanged generator snapshots. Content requests, configuration validation and generator/session integration pending. |
| 1.6 Events / results / replay | Active | All computed summary fields match 8 original CompletedEvents exactly. Full results, eligibility, histories and replay pass native/browser references; malformed/historical edge coverage and incremental playback facade pending. |
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
- Native generator now matches all 61 original snapshots with no skipped cases, including quote queue state, repeated quotes, IDs, British text, Morse, arrows, IPs, pseudolang, weakspot and polyglot. Full configuration/content/session gate remains open.
- Native test, Clippy and format checks passed after language-rule integration. Final current-head browser/build rerun pending.
- Draft Stage 1 PR: https://github.com/voltcrash/oxytype/pull/184. Initial CI native/Wasm, SSR, delivery and frontend checks passed; package routing failure fixed locally (60 routing tests pass). Whole current-head CI not yet verified.
- Stages 2 and 3 have no implementation yet. No production deployment or release published.

- Current Cloudflare production build passes. Real-browser `engine-proof.migration.ts`: 2 tests pass (19 command traces and 61 generator snapshots). Generated binding types now cover content preparation and generator outputs.
- Expanded Wasm: 1,123,350 bytes raw (over 1 MiB budget), ~292.77 kB gzip (under budget). Optimization required; size gate explicitly not passed.

- Pinned Binaryen 132.0.0 optimization reduces expanded Wasm to 660,285 bytes raw / 261,217 bytes gzip. Both payload limits pass; optimized browser rerun still required.
- Session and generation now share one Rust Config/default implementation.
- All full CompletedEvents and historical derived arrays match original recordings. New one-time analysis capture checks replay frames, steps, final prompt/sounds, seeking, all practice combinations and validity flags against unchanged TypeScript. Native analysis regression passes for all eight recordings.

- Optimized real Cloudflare browser proof now passes 3 tests: all 19 command traces, all 61 generators, and all eight historical result/replay/practice references. Native full tests and Clippy pass.
- Adding full analysis exports increases optimized Wasm to 812,970 bytes raw / 321,266 bytes gzip (level 9). Raw passes; gzip exceeds 307,200-byte budget. Additional optimization is required. `--converge` and `--gufa` experiments did not resolve the excess; no budget was relaxed.

- Replaced general-purpose Morse normalization with a 492-entry immutable compatibility map captured from original TypeScript (Node 24.21.0 / Unicode 17.0). Exhaustive native parity passes every Unicode scalar and every isolated UTF-16 unit; original 61 generator snapshots still pass. No reference was regenerated.
- Expanded engine with analysis: 709,637 bytes raw / 271,030 gzip level 6 after optimization, within both payload budgets. Full browser rerun after this change remains pending.

## Next concrete engine gaps (before Stage 1 exit)

- Session must own incremental generation, custom limits and pending section requests; preserve final separator stripping and plus-X lookahead.
- Port browser preflight/layout observations, live config, slow-render failure policy, bailout/restart rules. Capture actual web discrepancies, including progression before batch failure.
- Add recorder delta invalidation when start rebases timestamps or finalization removes earlier observations; hosts must not accumulate stale deltas.
- Add persistent replay handle, malformed/bounded DTO checks, randomized lifecycle and memory/performance checks.
- Re-run optimized Cloudflare browser proof after Morse reduction, then fresh-checkout/complete CI and final performance budgets.
- Stage 2/3 remain pending; do not cut over website while these gaps exist.

- Session now owns an attached generator, incremental lookahead refill, final separator stripping, quote identity, custom time/infinite limits and explicit bailout state. Full snapshots are explicit; per-command word changes are incremental. Recorder deltas signal invalidation when origin changes or finalization/reset changes earlier events.
- Five new native session tests cover 150-word continuation, plus-zero refill/completion, custom time/infinite limits, recorder rebasing/finalization, and pre-mutation malformed config / oversized commits / bounded timer catchup. Browser integration of these new APIs still pending.

- New immutable funbox rule metadata and Rust compatibility/forced-config checks match all 2,304 ordered pairs and 768 setting cases captured once from TypeScript. A mechanical TypeScript guard checks metadata equality. Visual-only funboxes are accepted by generation; section funboxes remain an explicit missing-protocol error until the content lifecycle is implemented.
- Optimized Cloudflare proof at ccb7db67f passes all 3 tests after Morse reduction/session additions; asset 753.41 kB raw / 285.44 kB gzip (Vite report), within frozen payload budgets. New funbox code has native verification only so far.
