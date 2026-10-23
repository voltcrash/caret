# Rust engine migration progress

Implementation owner: sole agent; no delegation.
Starting commit: `7b1ae05f204be53b5d9f2714f21c6eea08b25935`.
Branch: `t3/rust-engine-migration`. Initial working tree clean.

## Delivery

Three PRs, stacked: Stage 1 engine → Stage 2 website → Stage 3 terminal.
Small commits at coherent behavior/build/documentation boundaries. Do not create
empty commits to inflate count. Do not publish production or releases implicitly.

## Current position

Stage 1 engine gate passed. Stage 2 website integration next; Stage 3 remains pending. Read root AGENTS.md and the complete migration
plan before edits. Installed workspace dependencies with frozen lockfile.
Phase 1.1 and 1.2 gates passed: inventory/baselines, lossless contract, frozen oracle and mismatch detection. Existing website engine remains authoritative until Stage 2.

| Phase | Status | Evidence / remaining gate |
| --- | --- | --- |
| 1.1 Inventory / baselines | Complete | See inventory.md, features.md, baseline.md and raw measurements. |
| 1.2 Contracts / fixtures | Complete | 19 command traces, 21 oracle/integrity tests; contract and classified gaps. |
| 1.3 Native / browser proof | Complete | Native 7 traces; Cloudflare real-browser finite slice; MIME/CSP, lifecycle, boundary benchmark. Budgets frozen. |
| 1.4 Input / lifecycle / timing | Complete | Native/built-Wasm traces, observed browser input, delayed completion, stale sources, reset/restart and 12,800 randomized commands. |
| 1.5 Generation / configuration | Complete | 61 original snapshots; section/fractional/live generation; all funbox policies; quote refresh RNG; typed recovery and bounded malformed content. |
| 1.6 Events / results / replay | Complete | Eight exact original CompletedEvents/hashes/schema/backend outcomes, replay/seek, Unicode history, 1,387 live prefixes and malformed-log validation. |
| 1.7 Binding / engine gate | Complete | 24 built-browser cases, unchanged results/hashes, frozen payload/performance limits, fresh production build/typechecks; CI engine/native/Wasm and quality/package/SSR/delivery/update jobs pass at e7b7ad864. Existing website browser shards still running when this record was written. |
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

## Historical engine-gap checkpoint (resolved below)

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

- Input primitives now pass 2,048 deterministic TypeScript decision/blocking/deletion cases. New reference corpus factors identical config values into `defaults`; expansion was checked lossless before freezing (canonical expanded SHA256 0ea729f86f027243777e34ab66fbbba34fe466487772218d863a7a09264dd83a). No prior fixture changed.
- Rust preflight owns overflow eligibility/blocking and visual override policy; hosts provide measured wrapping. Explicit final-in-batch observation supports mechanical browser splitting; typography expansions now defer failure until their final unit. Native layout/batch tests added.
- Opt-in browser instrumentation proves master failure after a multi-character commit has already advanced website word index to 1. Rust still reports index 0 for this failure path. Must reconcile this known headless/web difference, including min-burst, before gate 1.4; never overwrite the old oracle to hide it.

- Reconciled commit-failure progression with the actual website. Built-browser master and minimum-burst tests both pass (word index advances before failure). Native tests pass against all 19 command fixtures; exactly one old headless min-burst frame is explicitly classified in `browser-contract-overrides.json`. Its original state/bytes are asserted unchanged before comparing the browser state. Events/scores retain exact equality. Current-head Wasm rerun pending.

- Current 0f7f2c13c Cloudflare build succeeds: 787.06 kB raw / 293.88 kB gzip (Vite), within payload budgets. Full browser proof and both actual-browser input-contract tests pass together: 5 tests, 19.7 seconds.

- Poetry cleanup and extracted Wikipedia text normalization match 11 newly captured TypeScript cases. Rust owns cleanup; hosts retain network and HTML extraction. Bounded section queue tests cover one outstanding token, source-kind validation, 16-section prefetch, generation cancellation and rejection of stale/forged replies. These are not yet connected to generator/session continuation.

- Initial section generation now resumes a retained batch across typed requests/replies, preserving already generated words and RNG state. Four content tests pass, including repeated generation and session creation after a delayed initial source. Native 61-generator snapshots still pass. Wasm request/supply declarations build and typecheck; browser behavior for section requests remains pending. Active-session continuation is the next dependency.
- Timing reconciliation still needs explicit attention: actual web completion captures time after navigation/hooks (and after async content replies), while input time is captured earlier. Consider a host-observed completion acknowledgement capability; Rust must own the decision, host supplies the actual monotonic/date observation. Never silently replace late completion timestamps with the original input timestamp.

- Active section requests now preserve one committed batch (maximum 65,536 units). Background prefetch permits typing while target words remain; only exhausting content blocks input/deletion. Matching replies resume progression and buffered units; reset/end invalidate the request. A failure after awaiting content uses the reply's observed completion time while retaining original input-event times. Seven native content tests cover cleanup, initial resume, active resume, stale replies/reset/expiry and delayed failure. Browser verification pending.
- Prepared tab/newline capabilities now include custom content beyond the initial 100-word window; a native regression covers newline acceptance before that future word is generated.

- New section-generation references cover poetry/article finite/time/repeat, lazy mode and random-case ordering. Native output and subsequent RNG draw match all five exactly; no old snapshots changed.
- Browser proof now also exercises delayed initial section preparation and active batch resume; combined actual-browser run: 6 tests pass, 19.1 seconds.
- Section exports increased release-profile Wasm to 854,263 raw / 310,646 gzip level 6, above gzip budget. A dedicated `wasm` Cargo profile (`opt-level=z`) plus existing Binaryen produces 748,995 / 288,742 bytes. Switching the build entry point to this profile; full browser/boundary retest pending.

- Dedicated Wasm `z` profile passes the actual Cloudflare browser proof: all 61 original + 5 section references, historical derivation, lifecycle/content requests, and both web behavior contracts (6 tests, 19.8 seconds). Boundary sample: JSON median 0.0065 ms / p95 0.0075 ms per UTF-16 unit; object p95 0.0105 ms; initialization 30 ms (single sample); 7 keyboard input-to-paint maximum 36 ms; Wasm memory 1,376,256 bytes. Raw evidence: profile-z-proof-performance.json. Full initialization distribution/soak/performance acceptance remains pending.

- Added opt-in host-observed finish acknowledgement: Rust requests completion/failure and blocks further input/ticks; the host supplies actual completion time after its navigation/hooks. Duplicate/stale/earlier acknowledgements are rejected. Native tests cover score-timing origin, blocked input, timer/failure reasons and reset cancellation. Default immediate sessions retain all command-oracle behavior. Browser proof for acknowledgement still pending.

## Additional cutover dependencies identified during integration review

- Completed: owned recycling retains learning, remembered pace, repeat words and quote identity; generations survive reset/replacement.
- Completed: typed Wasm pace operations and persistent replay handle.
- Replace min-burst whole-log cloning and provide bounded live-stat queries before long-session/per-key performance acceptance.
- Completed: concurrent compile/guarded initialization and owned retryable loader verified in the real browser.
- Expose structured recovery actions for missing quote/favorite/polyglot content and active content failures; avoid string-matching rules in hosts.
- Completed: restart/no-quit/long-test and custom progress ported and checked natively/in browser. Production input adapter still awaits Stage 2.

- Slow-render policy now belongs to Rust: exact short-test thresholds/counters, failure before ticks, long/infinite catchup and overflow suppression. Native full suite/Clippy pass. Built Cloudflare browser proof passes all 5 Wasm tests, including observed completion time and slow-render failure; the actual website's slow-render contract passes separately. Initial web test hit an offscreen words-container click; corrected to the visible first word and reran (1 pass, 7.5 s). Existing master/min-burst tests also pass. Loader concurrency and persistent replay changes are subsequent work, not included in this evidence.

- Persistent replay now owns cursor, prompt and step position in Rust; ordinary steps return at most two changed words. Native replay regression reconstructs final prompts from deltas and checks sounds plus repeated seeks against all eight immutable recordings in normal/zen interpretations. Native regression and Clippy pass. Wasm facade added; built-browser verification pending.

- Cloudflare production build and combined browser migration run pass: 9 tests, 25.5 seconds. Includes all 19 traces, 66 generators, eight historical result/replay references, persistent playback deltas/sounds/seeks/disposal, completion timing, active content and actual web failure ordering. Concurrent cold initialization preserves five live handles; one failed Wasm download retries, one owner's load promise is shared, disposal rejects later loads. Type-aware lint passes. Asset: 766.89 kB raw / 297.25 kB gzip (Vite); both frozen payload limits pass. App-owned loader resource added; production website cutover remains pending.

- Captured 567 additional normalization boundaries from unchanged TypeScript. They exposed and now guard Russian named-variant equivalence: strip only legacy /_\d*k$/ suffixes; preserve named variants. Dutch expansion uses the same exact language boundary. Existing 2,048 input decisions and new normalization matrix pass natively. New expectations captured once with exclusive file creation; no previous fixture changed. Browser rerun pending.

- App-owned content can now consume/recycle a prior session, retaining weak-spot learning and remembered pace while dropping its log/input/pending work. Independent owners remain isolated. Typed Wasm pace operations added; native regressions cover learned generation after replacement, remembered repeat speed and UTF-16 bare-word stepping. All 26 newly frozen TypeScript pace frames match native positions and floating-point schedule values exactly. Native learning/input/pace suites pass; browser integration pending.

- Current built Cloudflare app passes 10 migration browser tests (26.1 s), adding all 567 language-normalization boundaries, 26 pace frames, learned word generation across replacement, consumed-handle rejection and owner isolation. Type-aware lint passes. Payload: 786.00 kB raw / 302.46 kB gzip (Vite), below the unchanged 1 MiB / 300 KiB limits.

- Build bootstrap now fingerprints sources/tool config and verifies every generated output hash before reusing bindings. The actual Vite multi-environment build performs one Rust/Wasm build and two verified cache hits. Deleted generated Wasm experimentally: bootstrap rejected the cache and rebuilt the identical 786,005-byte artifact (SHA256 91ff5be6f2168e9c6ae699ae111fd869f23fff698e91dc028830dadd0522f0b4); the following build verified and reused it. Rebuild removes obsolete generated declarations. No fresh-checkout gate claimed yet.

- Recycling now retains prior generated words and quote identity for explicit repeats. Repeating preparation reuses the previous quote without drawing/advancing its selection queue. Native regressions cover changed seeds, wordset reuse and the next unconsumed quote after repeat; four learning/repeat tests and Clippy pass. Browser adapter signature changed; regeneration and built-browser repeat checks pending. A further lifecycle audit identified request-generation reuse across newly prepared sessions; resolving before the engine gate.

- Preparation generations now advance across replacement, including prior session resets. Prefetched sources survive assigning the new generation; pending tokens do not. Native tests reject an old initial-preparation token and an active token from a recycled/reset session without changing the new log or pending request. Ten content tests and Clippy pass. Matching generations also protect deferred automatic input. Browser replacement/repeat checks pending.

- Built Cloudflare migration run now passes 11 tests (26.9 s): replacement sessions preserve repeated words/quote identity, quote repetition leaves the next queue entry untouched, and replaced source tokens are rejected. Asset: 787.06 kB raw / 303.14 kB gzip (Vite), within frozen limits. Restart-policy port is subsequent work and not part of this browser evidence.

- Restart policy now derives no-quit blocking, long/infinite quick-restart limits, repeated targets, quote language/failure conditions, incomplete recording and repeated pace from the Rust session/config. Native checks cover 180 newly frozen quick-restart boundaries and 10 quote-repeat preferences, plus active/inactive/failed guards. Four policy tests pass; TypeScript oracle/integrity/defaults suite passes 23 tests; Clippy passes. Hosts retain loading/result/animation guards and key selection.
- Ported long custom-text progress from completion.client.ts: UTF-16 display lengths, space/newline distinction, partial-last-word bailout and completed-book reset. Two native regressions pass, including isolated surrogates and prior progress at u32::MAX; browser/API coverage pending.

- Built-browser restart/progress checks pass: 13 migration tests, 27.9 s, including all 180 quick-restart boundaries/10 quote preferences and seven long-text progress cases (Unicode/newline/bailout/u32 boundary). Type-aware lint passes. Wasm 796,283 bytes; gzip level 6 304,335 bytes (Vite 306.77 kB). Generated development glue is 34,048 bytes; actual deployed minified facade/glue asset remains below the 32 KiB transfer budget. Further additions need size work; the unused measured object boundary is next to retire.

- Retiring the unused object-conversion benchmark removes serde-wasm-bindgen/js-sys and reduces Wasm to 688,430 raw / 274,470 gzip level 6 (Vite 276.52 kB), with deployed glue/facade 10,948 bytes. All 13 browser migration tests still pass (24.2 s); Clippy/type-aware lint pass. New JSON sample: median 0.0075 ms / p95 0.01 ms per UTF-16 unit; initialization 48.7 ms (single sample); paint maximum 35.7 ms; memory 1,376,256 bytes. Evidence: selected-json-proof-performance.json. Full initialization/soak/website performance gates remain open.

- Historical log bridge is SSR-safe and losslessly converts target words, input snapshots and composition data between JavaScript strings and UTF-16 arrays. Three tests cover every UTF-16 unit, original recordings/optional metadata and isolated text. Two new immutable historical Unicode references match native stats/frames/replay/seeks, then match real-browser Wasm through actual legacy string conversion. All 14 browser migration tests pass (26.1 s); native analysis, Clippy and type-aware lint pass. A parallel typecheck briefly ran while the prior builder had removed generated declarations; sequential rerun passed. Builder publication is being fixed separately.

## Historical Stage 1 exit checklist (resolved below)

- Structured native/binding errors, quote/favorite/polyglot recovery and failed-content lifecycle implemented; final malformed-input and lifecycle stress gates remain.
- Indexed live-stat/word-burst cache implemented; final browser/long-session performance evidence remains.
- Complete content/config/observation/log validation, checked transport DTO compatibility, randomized lifecycle/stale-handle checks.
- Final engine initialization distributions, long-session/restart memory and per-key performance budgets; full website startup/input/restart comparison belongs to Stage 2 after integration.
- Current-head full regression/backend submission/hash checks, fresh-checkout bootstrap and complete CI evidence.
- Stage 2/3 implementation and their two stacked PRs still pending. No deployment or release publication performed.

- Fixed generated-output publication: build/optimization occurs in a staging directory, then complete files replace prior output; obsolete declarations are removed afterwards. Forced rebuild probe observed 2,000 polls with no missing prior Wasm/glue/types and verified obsolete-file removal. The following build is a verified cache hit. Build target directory is explicit. This avoids the prior long typechecking gap; normal build success alone is not a concurrent-build/process-lock claim.

- Captured eight original TypeScript recovery paths once: absent quotes, selected/favorite IDs, empty length, zero/one polyglot languages and direction conflict. Fixture includes exact messages, ordered setting/funbox changes, no-save/no-restart flags and notice durations. Capture typechecks and refuses overwrite. Rust typed recovery port is next; no recovery gate claimed yet.

- Shared public session/content/generation operations now return structured EngineError values with codes and ordered typed recovery actions. All eight frozen quote/polyglot recovery messages/actions match natively, including empty-message notices and no-save/no-restart flags. Invalid config and stale replies have explicit codes; corrected preparation succeeds after every captured error. Full native suite and Clippy pass. Wasm currently preserves old error messages only; structured facade and failed-source lifecycle remain pending.

- Wasm now transports the native structured error DTO; browser EngineFailure exposes code/actions and preserves cause. Hosts never infer recovery from message text. The built Cloudflare proof passes all 13 engine-proof tests (26.9 s), including all eight frozen recovery cases, invalid UTF-16 command rejection without mutation, disposal and an injected ABI mismatch that prevents usable sessions. Two facade unit tests and type-aware lint pass. Clippy initially caught redundant result wrappers; removed them and reran successfully. Wasm: 696,520 raw / 278,194 gzip level 6 (Vite 280.38 kB). Other migration files were not part of this targeted run.

- Frozen source-error behavior before host cutover: initial poetry/Wikipedia false replies disable their funbox and throw the original message (new immutable source-recovery.json); active false replies show the exact error notice, disable the source and restart without completion. Actual website lifecycle characterization now passes 24 tests, including active undefined replies producing no error/restart. Capture typechecks and refuses overwrite. Native source-rejection implementation/tests are in progress separately.

- Native failed-source lifecycle now consumes only the matching token, returns the frozen initial/active recovery actions and rejects late/duplicate replies. An active failure blocks input/ticks pending host recovery, preserves already captured events, drops unlogged deferred units and leaves score failure unset. Host abandon records its actual clock; reset permits a new lifecycle. Two new regressions cover prefetched and exhausted states. Full native suite/Clippy pass; browser checks running.

- Built Cloudflare proof plus actual website input-contract suite: 17 tests pass (26.7 s). New browser checks match initial source errors and both buffered/exhausted active failures, preserve the log, block subsequent typing/ticks, reject late replies and abandon without a score failure. Type-aware lint and Clippy pass. Wasm remains within frozen transfer limits: 701.91 kB raw / 282.63 kB Vite gzip.

- Captured 1387 original TypeScript live-stat prefixes across all eight historical recordings before replacing the hot reads. Immutable live-stats.json includes partial character totals, unrounded accuracy and per-word bursts (non-finite JSON semantics preserved). Capture typechecks and refuses overwrite. Indexed native cache verification is ongoing.

- Replaced minimum-burst and timer minimum-speed/accuracy full-log JSON clones with indexed live derivation. Cache retains one word state per observed word, constant counters and timestamp/rank metadata; repeated edits add no cache entries. Reuses shared character/burst formulas and preserves delayed-observation ordering, first-appearance word order and legacy sentinel semantics. All 1,387 frozen live prefixes match exactly; delayed-order/cache-growth regression plus full native suite/Clippy pass. Finalize rebuilds cache after log cleanup; reset clears it. Browser/performance verification pending.

- Added typed session liveStats reads for partial character counts, rounded WPM/raw, cached accuracy (100 before input), elapsed seconds/duration, timer start and inter-input spacing. Browser bindings expose the same Rust result. Native regression covers error correction, same-batch zero spacing, fractional clocks, finalize/rebuild and reset; full native suite passes. No physical duration is inferred by this query.

- Added host-boundary validation for content UTF-16/count budgets, source/quote/language metadata, explicit random streams, observation shapes/depth and stored logs. Checked analysis/playback reject unknown versions, unsafe indices, malformed UTF-16/event fields and excessive chart times before allocation. Negative pre-start physical observations and historical optional metadata remain supported. Wasm JSON is bounded before deserialization. Full native suite passes, including three malformed-input regressions and unchanged historical parity. Browser validation checks pending; backend validation untouched.

- Randomized lifecycle testing found a real delta-contract bug: later input rounded to the same timestamp can sort before an already emitted timer event without changing the log origin. Updates now flag invalidation whenever a newly recorded timestamp/rank precedes prior output; no full-log scan is needed to detect it. 12,800 commands across 128 seeds now pass log projection, isolation, exactly-once completion and live-stat parity (17.0 s). Added a focused tie/delayed-input regression; Clippy passes. Browser validation run passed 16 cases; its one synthetic custom-progress log omitted required charIndex. Corrected that test-only metadata; targeted rerun passes. Frozen expected output unchanged.

- CI run 39902417497 exposed two tooling issues, not behavioral mismatches: Vite bootstrap diagnostics contaminated lint --print-config JSON, and Knip could not infer Binaryen's metadata-based executable lookup. Routed bootstrap child stdout/stderr to stderr; explicitly documented the build-tool dependency in Knip config. Local lint-check-config, Knip and type-aware lint now pass. Complete current-head CI still pending.

- Browser lifecycle proof: 20,000 UTF-16 units plus 100 replacement sessions pass live/minimum-rule progression, validation recovery and stable retained memory after warmup. Recorded 2,000-unit reset workload retains 9,240,576 Wasm bytes, below frozen 16 MiB; replacement memory stays flat. Long workload retains 81,395,712 bytes after explicit full-log export/reset: Wasm retains its allocation high-water mark, so this is not a claim that long-session memory shrinks to baseline. Active growth before log export is linear; detailed evidence retained separately. Maximum measured block cost 0.04585 ms/unit (long) / 0.07810 (reset), below 0.1.
- Initialization distribution: first combined run with the full backend suite concurrently executing failed the 100 ms p95 gate (256.7 ms). Retested alone under recorded timing conditions: 30 fresh contexts with HTTP cache disabled reach usable Wasm at p95 68.4 ms, median 50.3 ms, maximum 102 ms. Budget unchanged. Artifacts: engine-initialization-performance.json, engine-long-session-performance.json, engine-reset-performance.json. All 19 other browser cases passed in that combined run; isolated initialization rerun passes. Backend full suite passes 787 tests/63 files; targeted oracle/hash/anticheat suite passes 131 tests/9 files.
- Further contract audit found custom content limits are JavaScript numbers, while prepared Rust custom limits currently require integers. Fractional custom time/word/section values need frozen cases and a compatibility fix before Stage 1 exit. Checked completion/event DTOs and final fresh-checkout/CI gates also remain open.

- Fractional custom limits now remain f64 through generation, limits, repeated continuation and timing; generation boundaries preserve fractional end-word behavior in punctuation/underscore transforms. Existing native integer-call helpers forward to the same calculation. All 27 newly frozen original cases match exact words/section indices/all-generated state and next RNG draw; fractional custom time completion also passes. Full native suite/Clippy pass. Initial capture harness defects were fixed before porting, with the first diagnostic preserved unchanged and corrected references written to a new v2 file (decisions.md). Browser parity is next.

- Built Cloudflare Wasm now matches all 27 fractional custom generation cases (targeted browser check passes, 7.0 s). Original 61 generator snapshots and native fractional timing checks remain unchanged/passing.

- Generated binding DTOs now expose typed summary/chart/completed-result structures, custom/incomplete metadata and discriminated input/key/timer/composition events. Internal recorder retains extra host metadata; the SSR-safe legacy bridge remains a mechanical UTF-16 converter with Rust shape validation. Two wire regressions verify every command-fixture event round-trips through the generated shape and reject invalid actions/units. Full native suite, formatting, Clippy, workspace typechecks and three text-bridge tests pass. Actual Wasm results pass the unchanged CompletedEventSchema, all eight frozen transport hashes, unchanged backend integrity outcomes and tampered-score rejection (two targeted browser tests pass, 8.6 s).
- Fresh worktree at c670d393e: frozen install of 1,103 packages, no generated bindings/target directory; actual Cloudflare proof build automatically generated pinned Rust/Wasm/types, then all workspace typechecks passed. This verifies bootstrap at that checkpoint; current-head typed DTO checkout/build still to run before final gate.

- Added engine:test:wasm and engine:parity vp tasks; CI runs the same production build plus proof/input-contract/lifecycle browser files. Combined task passes native suite and 21 browser tests (51.1 s). Shared Node bootstrap now covers direct type-aware lint and root/package tests as well as frontend builds; diagnostics stay off structured stdout. Oracle/text/failure tests pass 28 cases; lint-config check and Knip pass. Fresh first-test/typecheck bootstrap verification pending.
- Final API audit: generation must adopt live Configure updates rather than retaining preparation-time rule settings, and shared funbox setting-policy functions need a typed Wasm entry point. Resolve both before closing the engine gate.

- Froze 30 original next-word outputs across six live configuration boundaries (punctuation, numbers, lazy accents, British conversion, ordered funbox transforms, restored defaults), including final RNG position. Capture imports the oracle after seeding, tracks host word count, snapshots each effective config and refuses overwrite.

- Configure now updates the owned generator's effective rule reads without rebuilding assets, RNG, learning or already prepared words. Native tests match all 30 frozen live outputs/final RNG state and verify Session-owned continuation receives new rules. Added typed shared setting-policy queries (compatibility, forced values, can-set) to native/Wasm; all frozen combinations/forced cases pass the checked entry point. Full native suite/Clippy pass. Browser checks for these two paths running.
- Isolated checkout a033a4273: deleted generated output, ran a direct oracle test (no prior build), bindings regenerated and 23 tests passed. Deleted generated output again, direct vp lint --type-aware --type-check also regenerated declarations and passed.

- Remaining binding audit item: expose the existing owned quote-queue refresh operation for quote-length setting changes (the legacy host calls updateQuoteQueue explicitly). Preserve cached-language load behavior and RNG consumption; do not rebuild the queue on every restart. Then finish API docs, current-head fresh-checkout/full CI and final performance records before opening Stage 2.

- Built-browser shared setting policies and live generation checks pass (two tests, 6.5 s): all frozen compatibility/forced-setting cases and all 30 live outputs match. Captured explicit legacy quote-length queue refresh once in quote-queue.json, including repeated selection on cached language and exact seeded RNG state after each operation. Capture typechecks/refuses overwrite; no prior reference changed.

- Explicit quote-length refresh now reaches the owned native queue through a typed Wasm operation; ordinary cached-language preparation does not rebuild it. Native fixture checks preserve all selected IDs and exact update/selection RNG states. Clippy passes. Actual Cloudflare browser proof passes all three final policy/live-generation/quote-queue cases (8.6 s).

- Final API built-browser suite: 24 tests pass (49.0 s) with controlled-host timing gates enabled; initialization p95 62.2 ms. Native suite/Clippy pass. Previous pushed checkpoint 9ab9bdc12 full CI passed (run 39928691398). Final payload check exposed 799,776 raw / 315,765 gzip6 bytes: gzip fails frozen 307,200-byte limit. Removing redundant Value-to-typed result deserialization; no size limit/reference changes. Current-head clean build and CI remain pending.

- Result summaries/completion now construct typed DTOs directly; native legacy Value helpers serialize that same structure. Removed the intermediate JSON object/deserializer while retaining checked finite-metric rejection. All eight original completed results remain exact, including the typed entry point; full native suite and Clippy pass. Optimized Wasm falls to 755,466 raw / 301,279 gzip6 bytes (budget 307,200). Final browser compatibility/performance rerun underway.

- Post-optimization final engine proof passes 24 browser cases (46.8 s), including exact schema/hash/backend outcomes and controlled performance gates. Initialization p95 45.1 ms; boundary p95 0.01050 ms/UTF-16 unit; minified glue/facade 13,540 bytes. 2,000-unit reset retains 9,240,576 bytes; long full-log workload retains 81,395,712 with zero warm replacement growth. Final raw artifacts retained separately. Fresh e7b7ad864 checkout with deleted target/generated/dist builds the actual Cloudflare proof and all workspace typechecks pass. Global pinned Rust/CLI tools reused; no runtime-tool-free install claim.

- Raw/gzip payload budgets now run on every engine build and verified-cache reuse; built-browser proof additionally checks deployed minified facade size. Targeted browser case passes with all frozen commands; type-aware lint and formatting pass. Initial test launch lacked the Node JSON import attribute; added it and reran successfully. No engine behavior changed.

## Stage 1 acceptance / Stage 2 handoff

Engine gate passed at e7b7ad864 plus automated payload checks ee676ab63. Current API behavior/native/Wasm parity, bounded failures/lifecycles, exact legacy result transport, frozen performance limits and isolated fresh-checkout build/typechecks verified. All original references remain unchanged. Full CI 39932135295 has passed engine, package/frontend/backend, quality, SSR, delivery, assets and update jobs; four existing website browser shards were still running at this handoff. Track their actual final outcome without claiming it early.

Stage 2 begins on a child branch/PR based on the Stage 1 branch. First work: browser-only app resource, loading/retry/disposal and configuration projection, then replace the typing loop and asset/result/replay consumers. The production website still uses TypeScript until integration passes. No production deployment or release publication performed. Stage 3 remains entirely pending.
