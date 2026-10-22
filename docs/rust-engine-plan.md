# Rust engine migration and terminal app

Status: implementation handoff. No implementation completed by this plan.

## Outcome and scope

Deliver one Rust typing engine, used by the existing SolidJS/TanStack Start website through browser WebAssembly and by a native Ratatui terminal app.

Keep three stages:

1. Build and prove the Rust engine.
2. Integrate the website, deploy safely, and retire the TypeScript engine.
3. Build and release the offline terminal app with local history.

Prove browser integration during Stage 1. Do not complete a native-only rewrite before checking the browser build. Stage 2 owns the full website migration.

Confirmed terminal scope: offline typing and local history. No account login, cloud result submission, browser handoff, or result sync in this project. Do not restore removed device-auth infrastructure.

Website scope: preserve current supported behavior, settings, data compatibility, and Cloudflare deployment. Do not combine this migration with a visual redesign, framework migration, score change, or backend rewrite.

## Current repository facts

Treat these as starting points. Verify them against the implementation commit.

- `packages/typing-core/README.md` describes the existing headless engine and its adapters.
- `packages/typing-core/src/session.ts` owns session events, input decisions, timer state, and completion. It explicitly preserves JavaScript UTF-16 input indices.
- The website is not merely a consumer of `session.insert/delete`: `frontend/src/ts/input/handlers/` also applies rules and logs resulting state. Porting only `TestSession` will miss behavior.
- `frontend/src/features/typing/runtime/events/data.ts` connects sessions to app-owned state. Session word position can currently come from the website.
- `packages/typing-core/src/` also contains config migration, themes, display formatting, command matching, asset loading, and other code that is not all engine logic.
- `frontend/src/server/operation.server.ts` imports config migration from the current package. Browser Wasm must not become a transitive dependency of that server module.
- Existing keystroke, generator, and anticheat fixtures live under `packages/typing-core/__fixtures__/`. Characterization and parity tests also exist under `frontend/__tests__/test/`.
- `packages/typing-core/src/result-hash.ts` uses `object-hash`. The website adds submission fields before hashing in `runtime/result-saving.ts`. A generic Rust JSON hash is not a compatible replacement.
- Backend anticheat tests read core fixtures. Backend validation remains authoritative and must keep working.
- `frontend/vite.config.ts` already combines TanStack Start and the Cloudflare Vite plugin.
- `.github/workflows/oxytype-ci.yml` selects jobs by changed paths. New Rust paths must trigger the relevant native, Wasm, browser, and delivery jobs.
- `.github/workflows/production-release.yml` rebuilds the deployment commit. That build also needs the pinned Rust/Wasm tools.
- `frontend/scripts/preserve-assets.ts`, update tests, and `frontend/static/_headers` matter for old tabs and immutable assets.
- Historical terminal/device-auth documents in `docs/archive/` are reference material, not current requirements.

## Architecture decisions

### Ownership

Rust owns all shared typing behavior: input acceptance and deletion, progression, timing calculations, generation and transforms, test completion, scoring, histories, and replay derivation. One authoritative state machine; independent sessions.

The website owns DOM input events, composition lifecycle, focus, rendering, caret layout, audio, accessibility, network/storage access, account state, and server transport. Adapters translate observations into commands; they do not decide scores or progression.

The terminal owns terminal events, raw mode, drawing, display widths, local files, and platform capabilities. It calls the Rust core directly; no Wasm runtime in the native app.

The backend remains TypeScript on Cloudflare. Keep its validation, auth, database, and anticheat responsibilities. Independent server validation is not a second client engine.

Keep web-only settings migration, labels, themes, and formatting in TypeScript where appropriate. Move them out of `typing-core` if needed. Engine defaults and rule policies must have one source; a settings adapter must not duplicate them.

### Proposed layout

Finalize exact package names in Phase 1.2; use these names as the default:

- Root `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`: one Rust workspace and pinned tools.
- `crates/typing-engine/`: platform-independent Rust library.
- `crates/typing-engine-wasm/`: thin `wasm-bindgen` boundary; no second engine.
- `crates/oxytype-tui/`: Ratatui/Crossterm executable, added in Stage 3.
- `packages/typing-engine/`: workspace package for generated bindings and thin typed adapters. Generated output is build output, not hand-maintained source.
- `packages/typing-fixtures/`: language-neutral fixtures, schema descriptions, and provenance. Move existing fixtures with all readers updated.
- Existing/new narrowly scoped TypeScript packages: non-engine helpers extracted from the old package. Choose names after the consumer inventory; do not create a miscellaneous dumping ground.
- `docs/rust-engine/`: contract, feature inventory, performance evidence, compatibility decisions, terminal support matrix, and release notes.

### Engine interface

- Explicit commands for creating/resetting a session, inserting committed text, deleting, observing physical keys/composition metadata, advancing time, ending/abandoning a test, and supplying generated/loaded content.
- Explicit configuration, capabilities, seed/random source, elapsed time, and wall-clock metadata. No hidden system clock, network, filesystem, DOM, terminal, or process-global mutable session state.
- Return ordered events and a small state update. Supply full snapshots and full logs only on request. Avoid serializing the entire log after every key.
- Separate display state from transport DTOs. The binding translates representations, not typing rules.
- Assets are loaded by the host. Prepare content before play where possible. If more content is needed, return a request token; the host supplies it later. Define input ordering and cancellation while waiting.
- Use a versioned binding contract and preserve the existing event/result format unless an explicit compatibility decision requires a change.
- Browser timestamps come from a monotonic clock. Native elapsed time comes from `Instant`; wall-clock dates are separate metadata. Do not use wall time for input intervals.
- No shared-memory threads, `SharedArrayBuffer`, Web Worker, or cross-origin isolation requirement for the initial implementation. Add off-thread work only if measurements justify its added protocol.

### Compatibility policy

- Preserve existing web scores, generation semantics, config behavior, save eligibility, event ordering, replay, and historical data interpretation.
- Freeze the existing TypeScript behavior as a test oracle. Rust changes must not force baseline regeneration.
- Resolve differences between the headless session and actual web handlers by recorded browser behavior and documented decisions. Do not silently choose whichever implementation is easier.
- Define JavaScript rounding, omitted/null fields, non-finite number handling, timestamp precision, and seeded random consumption. Native and Wasm must produce equivalent outputs.
- Treat byte offsets, UTF-16 positions, Unicode scalars, grapheme clusters, and terminal columns as different units. Name units in contracts.
- Account for partial surrogate handling: Rust `String` cannot represent isolated UTF-16 surrogates. Select a lossless compatibility representation where legacy behavior requires one; do not assume `chars()` preserves JavaScript indexing.
- Preserve old event-log interpretation. Any intentional Unicode correction needs versioned behavior and explicit fixtures, separate from an unreviewed port change.
- Keep the existing web submission hasher in a thin transport helper unless a tested, byte-compatible replacement is necessary. The offline terminal app does not need server submission hashes.

## Stage 1 — Build and prove the engine

### Phase 1.1 — Inventory behavior and capture baselines

Work:

- Inventory every `@oxytype/typing-core` import, including tests, scripts, server code, type-only consumers, and re-export modules.
- Classify every source module: engine, browser adapter, terminal adapter, content asset, shared contract, server validation, or presentation/settings helper.
- Inventory rules still implemented in web handlers: insertion, deletion, composition, progression, code indentation, funbox hooks, restart, and completion.
- Build a feature checklist covering all test modes, custom limits, quote sources, languages, lazy modes, punctuation/numbers, repeats, difficulty, confidence, error handling, pace/weak spots, generation, replay, and results.
- Map each funbox into rule behavior and presentation behavior; inventory relevant `@oxytype/funbox`, schema, and utility dependencies.
- Run existing parity/characterization tests. Record existing failures separately; do not silently accept them as migrated behavior.
- Capture current browser startup, first usable test, input-to-paint, restart, long-session memory, and payload-size baselines using existing performance scripts where suitable.

Deliverables: `inventory.md`, feature checklist, consumer map, baseline evidence with commit/browser/device/build conditions.

Gate: every current core module and rule-bearing browser path has an owner and a destination. Baselines are reproducible.

### Phase 1.2 — Freeze contracts and shared fixtures

Depends on: 1.1.

Work:

- Define engine commands, events, state updates, errors, lifecycle, configuration projection, content requests, timestamps, RNG behavior, and all index units.
- Define which rules are immutable during a test and which settings may change live. Preserve existing effective behavior.
- Define one source for engine defaults, supported modes, and rule capabilities; generate/check any TypeScript declarations and metadata needed by consumers.
- Keep existing TypeScript/Zod API schemas authoritative for web transport. Generate or mechanically check Rust DTO compatibility; avoid manually maintaining two unchecked schemas.
- Move/copy fixtures into a stable language-neutral package, preserving provenance and original snapshots. Update all consumers if paths move.
- Separate runtime/binding version, engine behavior version, and stored event-log version. Document their compatibility rules.
- Extend missing fixtures for multi-character commits, IME, deletion across words, code tabs/newlines, Unicode, zero-length/infinite modes, timer stalls, and finish/reset races.
- Implement the TypeScript oracle runner and differential-harness interface. In 1.3, connect native Rust and browser Wasm. All three receive identical config/content/random stream/commands/timestamps; compare intermediate events/state as well as final scores.
- Define numeric comparison rules. Require exact structural/event equality; use explicit field-specific tolerances only where justified. Preserve rounded published score outputs exactly.

Deliverables: `contract.md`, shared fixtures/schema, runnable oracle harness, compatibility checklist.

Gate: the contract is implementable by both hosts, and the harness detects a deliberately introduced behavioral mismatch. No unclassified fixture gaps.

### Phase 1.3 — Rust workspace and early browser proof

Depends on: 1.2. This is a small vertical slice, not the complete port.

Work:

- Add the Rust workspace, pinned toolchain/MSRV, lockfile, license metadata, formatting/lint policy, native and `wasm32-unknown-unknown` targets.
- Implement one small deterministic finite-word session with insertion, deletion, elapsed time, and completion.
- Run the same fixture against native Rust and browser Wasm through the planned binding.
- Build the proof through the actual Vite/TanStack Start/Cloudflare production path. Confirm the module is a browser asset, initialized only after entering the client boundary.
- Prove two independent sessions, disposal, recreation, and failure recovery. No global session singleton.
- Measure binding cost, Wasm transfer size, startup/initialization, and input-to-paint against the baseline. Set numeric budgets in `performance-budgets.md` before the full port; include test conditions and permitted variance.
- Prefer synchronous core calls after asynchronous module/content preparation. Benchmark incremental object conversion against alternatives before choosing the hot-path representation.
- Keep a test harness/native fixture runner only; do not build the full Ratatui app yet.
- Add `vp` tasks for build, test, format, and Clippy. Tasks invoke Cargo/Wasm tools; developers use `vp` entry points.

Deliverables: working native/browser proof, build scripts, initial CI jobs, budget evidence.

Gate: a real browser using the built Cloudflare app completes the slice locally with equivalent native output. No unsupported dependency/runtime requirement or unexplained budget failure.

### Phase 1.4 — Input rules, session lifecycle, and timing

Depends on: 1.3.

Work:

- Port normalization, validation, commit separators, insertion limits, spaces/newlines, Shift rules, confidence/freedom modes, deletion, delete-on-error, code indentation, difficulty, and failure conditions.
- Centralize authoritative word index and input history in the engine. Remove the need for host callbacks to decide engine progression in the new contract.
- Port start, tick, drift/catchup, finish, end, abandon, reset, restart rules, incomplete duration, pace, and weak-spot behavior.
- Preserve observation of physical keys and composition metadata without making those capabilities mandatory for committed-text input.
- Specify ordering for simultaneous timestamps, rapid resets, delayed asset replies, and commands received after finish/disposal.
- Exercise session isolation, long input, timer boundaries/stalls, repeated edits, restart storms, and completion exactly once.

Deliverables: native implementation and shared-fixture coverage for the complete input/lifecycle checklist.

Gate: every migrated rule matches recorded web behavior at intermediate and final states; no duplicate host-side rule is required.

### Phase 1.5 — Generation, content rules, and configuration

Depends on: 1.3 and the frozen contract. May run alongside 1.4 with separate module ownership.

Work:

- Port generation for time, words, quote, custom, zen, finite/infinite limits, sections, repeats, punctuation, numbers, and applicable language transforms.
- Preserve seeded generator snapshots and random draw order through an explicit test random source. Specify a reproducible production algorithm/seed contract rather than relying on a library default.
- Separate fetched content from transformations. Hosts fetch language/quote/poetry/Wikipedia data and provide content; platform-specific HTML extraction stays in an adapter.
- Port rule-bearing funbox transforms and compatibility decisions. Keep visual/audio hooks with the website. Check every inventory entry; do not silently disable features.
- Define normalized engine config and shared rule/default validation. Keep legacy website preference migration and presentation metadata outside the Rust hot path.
- Validate content/config inputs with useful errors. Bound queued inputs/content requests and avoid unbounded generation in infinite modes.

Deliverables: generator/config modules, checked-in content fixtures, deterministic snapshots, feature checklist updates.

Gate: every supported website generation/config combination has an implementation or a documented blocking gap. No gaps may be carried into web cutover.

### Phase 1.6 — Events, scoring, completion, and replay

Depends on: 1.4; integrate generated content from 1.5.

Work:

- Port recorder and derived stats: accuracy, WPM/raw, character totals, bursts, consistency, key spacing/duration, histories, idle/incomplete time, and chart series.
- Port final result derivation, rule-level validity/eligibility, replay construction/seeking, and supporting practice/pace calculations.
- Preserve synthetic input and estimated release markers. Missing physical observations must remain distinguishable from measured ones.
- Preserve legacy event-log/CompletedEvent formats, optional fields, rounding, and JSON semantics at the adapter boundary.
- Keep web-specific user ID, tags, challenge data, transport hashes, retries, and network submission in host code. Keep shared calculations in Rust.
- Test historical recordings, save payload schemas/hashes through the existing transport helper, frontend replay, and backend anticheat fixture consumers.

Deliverables: event/stat/replay modules and native/Wasm parity results for full sessions.

Gate: published result fields, hashes at the transport boundary, event ordering, and replay outputs remain compatible. Backend rejection behavior does not change unintentionally.

### Phase 1.7 — Finalize bindings and engine release gate

Depends on: 1.4–1.6.

Work:

- Complete the thin Wasm facade with generated types, explicit initialization, instance ownership/disposal, structured errors, and a version check.
- Keep allocation/copying bounded on each key. Export deltas; retrieve full history/log only when needed. Test stale handles and repeated disposal.
- Run shared fixtures against all three paths: old TypeScript oracle, native Rust, and real-browser Wasm.
- Add malformed-command/config tests, randomized command sequences with invariants, long-session memory checks, and targeted numerical/Unicode tests.
- Make fresh-checkout dev/test/build regenerate bindings automatically. Pin `wasm-bindgen` tooling consistently with the crate; cache by lockfile/toolchain/target/profile.
- Ensure Rust-only changes trigger native/Wasm tests and applicable browser/build jobs. Document per-phase commands and expected outputs.

Deliverables: usable engine/bindings packages, CI checks, engine API docs, completed Stage 1 checklist.

Stage exit: full engine behavior passes native/browser parity and agreed budgets. Website remains on its existing production engine. No full UI rewrite required to reach this gate.

## Stage 2 — Integrate and deploy the website

### Phase 2.1 — Browser ownership, loading, and lifecycle

Depends on: Stage 1.

Work:

- Add a browser-only `*.client.*` adapter and an app-owned engine resource. Keep session state under existing app/route owners, not module-level mutable variables.
- Load the module/content before enabling a test. Represent loading, ready, failed, retry, and disposed states in SolidJS components.
- Keep an existing usable loading/failure UI. Initialization failure must not accept unprocessed input or silently lose a test.
- On route leave/restart, invalidate stale requests, release sessions/listeners/timers, and reject old content replies. A reload/retry must create a clean instance.
- Preserve server rendering and static `noscript`/`#nocss` fallbacks. No browser initialization during SSR, prerender, or server config migration.
- Select implementation per whole session during migration. Never switch engines halfway through a test or replay commands with side effects twice.

Deliverables: owned resource/adapter, lifecycle tests, loading/retry UI, SSR import-boundary checks.

Gate: mount/unmount/navigation/restart and failed initialization leave no live orphan session, listener, timer, or stale update.

### Phase 2.2 — Replace input and timer paths

Depends on: 2.1.

Work:

- Route beforeinput/input, keydown/up, composition, paste, deletion, restart, and timer observations through the adapter.
- Replace engine decisions in `frontend/src/ts/input/handlers/` and helpers with core commands/events. Keep browser event quirks in normalization adapters.
- Preserve IME commit order, textarea reconciliation, mobile input, Firefox deletion behavior, surrogate positions, multi-character text, and automatic indentation.
- Process commands in capture order with captured timestamps. Avoid a promise queue that changes event time or completes stale commands after reset.
- Update existing SolidJS state and word/letter rendering from engine updates. Keep caret measurements and allowed imperative DOM work in component-owned refs/lifecycles.
- Engine progression owns word/input state; remove two-way feedback that allows UI state to override it. Keep visible word windows as presentation state.
- Schedule ticks in the host; compute elapsed time, catchup, score effects, and finish decisions in Rust.

Deliverables: working migrated typing loop and browser characterization coverage.

Gate: rapid input, paste, deletion, IME, focus changes, stalls, restart, and navigation match current behavior without duplicate input/events or lost keystrokes.

### Phase 2.3 — Replace generation and supporting rule consumers

Depends on: 2.2. Non-overlapping content/settings work may begin after 2.1.

Work:

- Connect asset loaders and async content replies to Rust generation. Preserve lazy loading, route cancellation, asset hashes, and custom-text progress.
- Migrate mode/repeat/restart/practice/pace/weak-spot consumers. Split funbox rule hooks from visual/audio hooks.
- Project normalized engine config from existing web settings. Preserve live-setting behavior, settings imports/exports, presets, URL overrides, and config event sequencing.
- Extract web-only config migration/themes/metadata/helpers from the old core. Update browser and server imports; do not make SSR load the browser binding.
- Keep engine policies/defaults authoritative in Rust/generated artifacts. Add checks wherever schemas or metadata mirror engine identifiers.

Deliverables: migrated generator and supporting consumers, extracted TypeScript helpers, inventory with all destinations populated.

Gate: the generation, settings, and supporting-rule checklist passes. Server config/preset migration behaves as before with no browser-only import. Results/replay follow in 2.4.

### Phase 2.4 — Replace completion, results, and replay

Depends on: 2.2–2.3.

Work:

- Connect Rust completion, validity, histories, charts, and replay to existing result components and completion orchestration.
- Preserve account metadata, tags/challenges, local/signed-out result handling, custom-text progress, save retries, exports, and screenshot behavior.
- Keep web payload hashing after all required fields are applied, preserving current schemas and backend acceptance.
- Test old saved event logs/results alongside new output. Historical replay must not depend on the removed TypeScript engine.
- Run backend anticheat/result acceptance fixtures. Do not weaken validation to accommodate migration errors.

Deliverables: complete results/replay integration and transport compatibility evidence.

Gate: authenticated and signed-out completion, rejected/invalid tests, save/retry, history, exports, charts, and replay pass their relevant checks.

### Phase 2.5 — Cloudflare delivery and performance

Depends on: 2.1–2.4. Build plumbing may start earlier after 1.3.

Work:

- Build Wasm/bindings before Vite in development bootstrap, production, staging, CI, and release workflows. No developer must manually copy generated files.
- Publish browser `.wasm` and glue as versioned/hashed assets. Verify asset URL generation, `application/wasm`, CSP compatibility, caching, and actual production loading.
- Keep the typing engine client-side. Cloudflare Workers continue SSR/API/auth duties; they do not process each keystroke.
- Integrate Wasm/glue with existing asset preservation/update mechanisms. Test an old open tab loading its matching engine after a new deployment.
- Check online reload, already-cached use, interrupted download/retry, missing asset, stale client, and rollback. Full offline website support is not newly required by this project.
- Run Wrangler dry-run and existing workerd/Start delivery, SSR, browser, and update checks. Pin build tools in production workflow as well as PR CI.
- Compare startup, input-to-paint, restart, long-session memory, and transfer size against Phase 1.3 budgets under the recorded conditions. Investigate regressions rather than adjusting budgets after the fact.

Deliverables: deployable artifact, updated CI/path filters, release/rollback instructions, browser/performance/delivery evidence.

Gate: clean-checkout build and Cloudflare preview pass the production path. Old and new assets stay paired; browser initialization is absent from server bundles.

### Phase 2.6 — Cut over and retire the TypeScript engine

Depends on: 2.1–2.5, all website features complete.

Work:

- Exercise the Rust path in local/CI and staging before production cutover. Preserve an immutable pre-cutover release for rollback.
- If a temporary build flag is useful, make it release-scoped and choose the engine before session creation. Do not keep a permanent dual-engine fallback.
- Compare results and performance evidence, then use the established deployment workflow. Follow existing release authorization; this plan alone is not an instruction to publish production immediately.
- Remove TypeScript implementations of migrated rules and old runtime facades after cutover validation. Update tests to import the new facade or neutral fixtures.
- Move remaining non-engine utilities/types into their proper package. Remove `@oxytype/typing-core` when it has no required consumers; do not preserve an empty compatibility package indefinitely.
- Retain frozen oracle fixtures/output, provenance, and migration reports. After removal, CI compares native and Wasm to those references; it does not require a maintained TypeScript engine.
- Verify no active TypeScript source computes migrated client progression, generation, scoring, or replay rules. Independent backend checks and wire hashing are permitted responsibilities.

Deliverables: Rust-backed production-ready website, removed legacy engine, final consumer inventory, rollback record, Stage 2 sign-off.

Stage exit: the website uses Rust exclusively for engine behavior; server deployment/data compatibility remain intact. Only Rust engine code requires future typing-rule changes.

## Stage 3 — Offline Ratatui terminal app

### Phase 3.1 — Native shell and terminal lifecycle

Depends on: Stage 2 for the staged rollout. A non-production shell may begin after 1.7 if separate ownership is available.

Work:

- Add `oxytype-tui` using Ratatui and a supported input/backend library such as Crossterm. Depend directly on `typing-engine`.
- Separate terminal event reading, native engine commands, and drawing. Keep all typing decisions in the shared core.
- Provide launch/help/version, new test, active test, result, settings, and local-history screens.
- Enable/restore raw mode and alternate screen with cleanup for normal exit, errors, panic, and supported signals. Document uncatchable termination limits.
- Handle resize, a minimum terminal size, unsupported/non-interactive terminals, and suspend/resume where supported. Avoid busy-loop drawing.

Deliverables: runnable shell, native loop, lifecycle checks, `vp` dev task.

Gate: start/type/finish/restart/quit works without network; normal errors and panic leave the terminal usable.

### Phase 3.2 — Offline content and typing modes

Depends on: 3.1.

Work:

- Package a licensed offline content set: default English words plus a small quote corpus. Include required license/attribution files; no first-run download.
- Support time, words, quote, custom text/file, and zen modes, with punctuation/numbers, restart/repeat, and applicable shared difficulty/error settings.
- Use the same Rust generators, seeds, input rules, timers, validity, and scores as the website. Terminal UI must not recalculate them.
- Accept local content packs in a documented versioned format to extend languages/quotes. Validate invalid/oversized content and encoding with clear errors.
- Show word highlighting, caret, timer, live WPM/accuracy, and finish/failure reason. Expose command-line mode/settings options and in-app settings without two config parsers with different defaults.
- Create a terminal capability list. Reject unavailable web-only modes/hooks explicitly; never silently substitute another test.

Deliverables: complete offline typing flow, bundled content, terminal feature/support checklist.

Gate: all advertised modes work from a fresh offline install. Given equal commands, times, seeds, and content, terminal/native results match browser fixtures.

### Phase 3.3 — Input capabilities and Unicode rendering

Depends on: 3.1–3.2.

Work:

- Map characters, Backspace, word deletion, Enter, Tab, restart, and quit explicitly. Handle repeat events without counting one press twice.
- Detect negotiated keyboard protocol features. Do not assume terminal key-release, physical-key identity, modifier, or composition events exist.
- Mark unobserved timing data unavailable; do not fabricate browser-like key durations. Local history must distinguish unavailable values from measured zero.
- Reject bracketed paste as typing by default and show a short notice. Allow paste into custom-text setup. Document weaker detection when a terminal sends paste as ordinary key events.
- Convert engine positions to grapheme/cell coordinates for display. Test combining marks, wide characters, emoji, tabs, and line wrapping without changing engine score/index semantics.
- Document RTL/complex shaping/IME limitations by tested terminal rather than claiming browser-equivalent rendering. Unsupported capabilities must not corrupt input/state.
- Test at least Linux, macOS, and Windows Terminal; include one enhanced-keyboard terminal and one basic terminal. Cover resize, scrollback, rapid typing, and supported suspend/resume.

Deliverables: input adapter, rendering cases, keyboard/terminal capability matrix, manual verification record.

Gate: supported terminals render/capture the advertised content accurately; missing capabilities are explicit and do not produce false timing data.

### Phase 3.4 — Settings and local history

Depends on: 3.2–3.3.

Work:

- Store settings and history under OS-appropriate user directories. Provide explicit directory overrides for portable/testing use.
- Use a versioned local format with atomic writes and safe behavior under interrupted writes, malformed data, or simultaneous app instances. Choose JSON/JSONL or SQLite based on concrete needs and document the choice; avoid silent data loss.
- Save result summary, effective config, content identity/seed, timestamp, engine/format version, and available measurement capabilities.
- Provide history browsing, details, filtering by mode, local personal bests, and JSON export. Offer replay only if the necessary event log is actually persisted.
- Do not persist custom text or full input logs by default; they can contain private text. Make optional replay recording explicit and document storage/retention.
- Provide readable terminal themes, reduced animation, high contrast, and color-independent error markers. Keep shared score data separate from display formatting.
- Keep all functionality offline. No account token storage, telemetry, auto-upload, or cloud sync infrastructure.

Deliverables: local config/history subsystem, format/migration docs, corruption/concurrency tests, usable history/settings screens.

Gate: results survive restart; failed writes leave prior data intact or report recoverable loss clearly. History/export works with unavailable key timing and multiple engine versions.

### Phase 3.5 — Packaging, release, and documentation

Depends on: 3.1–3.4.

Work:

- Add native release builds for Linux x86_64/ARM64, macOS Intel/Apple Silicon, and Windows x86_64. Treat each as supported only after a successful build and smoke check; document libc/minimum OS requirements.
- Publish versioned archives with checksums, license/attributions, installation instructions, and uninstall/data-path instructions. GitHub Releases is the initial channel; extra package managers can follow.
- Add a tagged-release workflow with the required minimal permissions, pinned tools, native tests, and archive smoke checks. Terminal packaging must not block ordinary website deploys on unrelated changes.
- Include engine/build version in `--version` and diagnostic output. Keep website and terminal artifact versions traceable to the same core commit.
- Verify an installed binary runs without Rust, Node, Bun, network, or files from the source checkout.
- Update root documentation for the Rust engine, web Wasm build, offline app, supported terminals, local data, and contribution commands.
- Use the established release authorization before publishing artifacts. A completed PR can be release-ready without publishing automatically during development.

Deliverables: tested release archives/workflow, installation docs, support matrix, final Stage 3 checklist.

Stage exit: supported downloadable terminal executables provide offline typing and local history using the exact shared Rust engine. Website remains independently deployable on Cloudflare.

## Agent execution protocol

### Assignment unit

Assign one phase, or a clearly bounded subtask within one phase, per implementation agent. Each task receives this plan, `contract.md`, relevant inventory entries, prerequisites, and exact file ownership. A phase is not complete because its code compiles; its gate must pass.

Suggested task brief:

> Implement Phase <ID> from `docs/rust-engine-plan.md`. Read repository instructions and current contract/inventory first. Confirm prerequisite gates and record the starting commit. Change only the assigned ownership area; coordinate shared-file edits with the integration owner. Preserve the compatibility policy. Add targeted behavior tests and run required checks through `vp`. Return changed files, completed checklist items, verification commands/results, fixture differences, performance evidence when relevant, and remaining blockers. Do not regenerate reference snapshots to hide differences, add a second engine implementation, or publish a release without existing authorization.

### Safe parallel work

- After 1.2/1.3: separate owners can work on input/session (1.4), generation (1.5), and pure statistics from 1.6. Recorder/completion integration still waits for agreed events and session behavior.
- A binding/build owner can work alongside core ports after 1.3. Freeze the command/event contract first.
- In Stage 2: use separate owners for input/lifecycle, content/config extraction, result/replay, and delivery. The integration owner alone merges shared runtime/state changes.
- Stage 3 settings/history and packaging can develop against a frozen native interface while input/rendering stabilizes. Packaging sign-off waits for app checks.
- Keep the main migration order sequential: Stage 1 gate, Stage 2 gate, Stage 3 release gate. Early terminal shell work must not force engine API changes or delay website compatibility.
- Use one owner for root Cargo manifests/lockfile, package/build scripts, and shared contract changes. No competing edits to these files.
- When using separate worktrees, start from committed prerequisites. Do not assume another agent's uncommitted changes are present. Merge prerequisites before dependent verification.

### Pull requests and review

- Prefer one reviewable PR per phase; split large feature ports by the inventory checklist. Avoid a single rewrite PR.
- Every PR states the phase, ownership, before/after behavior, acceptance evidence, compatibility exceptions, and remaining work.
- Keep generated-output policy consistent. Commit source, lockfiles, generator config, fixtures, and manifests; CI generates ignored bindings/binaries. Typechecking must bootstrap generated declarations from a clean checkout.
- Track deviations in `decisions.md`. Ordinary implementation choices may be resolved by the owner; behavior/scope changes require explicit review.
- Do not update historical fixture snapshots except for a separately explained and authorized behavior change. Add regression cases for discovered discrepancies.

## Verification and final acceptance

All commands use `vp`. Add root tasks such as `engine:build`, `engine:test`, `engine:test:wasm`, `engine:parity`, `engine:lint`, `engine:fmt`, `tui:dev`, `tui:test`, and `tui:build`. Their implementations may invoke Cargo and Wasm tools. Do not introduce Bun or a second JavaScript package manager.

- Single TypeScript test file: `vp test run path/to/test.ts`.
- Type-aware checks: `vp lint --type-aware --type-check --format agent`, scoped as appropriate; do not invoke `tsc`.
- Rust tasks must run formatting checks, Clippy, native tests, target checks/builds, and browser Wasm behavior tests appropriate to their phase.
- Reuse repository unit, characterization, Start/SSR, update, delivery, backend, and browser workflows. Follow the repository's documented browser-test workflow; do not replace its environment with an unrelated harness.
- Use frontend `.tsx` components, Tailwind `class`, `cn`, and `Fa`. Preserve app ownership, router navigation, server/client boundaries, and static warning fallbacks.
- Tests must check externally meaningful behavior, lifecycle failures, compatibility, and portability. Do not add tests that merely restate implementation details.
- Record any environment limitation honestly. The planning checkout did not have project-local Vite+ dependencies installed; no implementation checks were claimed by this document.

Final completion requires all of the following:

- Every current web engine feature is accounted for and passes its compatibility gate.
- Native Rust and browser Wasm agree on shared command fixtures, not only final WPM.
- One engine owns client typing rules. No maintained TypeScript scoring/generation/progression/replay implementation remains.
- Historical web logs/results/settings and backend acceptance remain compatible.
- Cloudflare clean builds, SSR boundaries, Wasm delivery, updates, stale tabs, and rollback are verified.
- Measured browser performance meets the recorded budgets.
- Terminal releases work offline with bundled content and durable local history; runtime tools are not required for users.
- Supported keyboard/Unicode limitations and unavailable observations are documented accurately.
- CI path filters, fresh-checkout setup, pinned tools, and separate web/native release paths are complete.

## Decisions left to implementation

No product question blocks Stage 1. Terminal offline/local-history scope is confirmed.

- Phase 1.2 records exact crate/package names, config boundaries, schema-generation strategy, and UTF-16 compatibility representation.
- Phase 1.3 selects tested Rust/Wasm tool versions and sets measured numeric performance budgets.
- Phase 3.2 selects an appropriately licensed bundled quote set and documents the supported settings/funbox subset.
- Phase 3.4 selects the local storage format and default retention policy.
- Phase 3.5 confirms the supported OS/CPU matrix through actual release builds.

Escalate only if a choice changes confirmed scope, web behavior, deployment constraints, or an agreed acceptance budget.

## Technical references

- [wasm-bindgen deployment targets](https://wasm-bindgen.github.io/wasm-bindgen/reference/deployment.html): browser and Node bindings have distinct initialization/packaging targets.
- [wasm-pack build outputs](https://wasm-bindgen.github.io/wasm-pack/book/commands/build.html): generated JavaScript, Wasm, declarations, and package output.
- [Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/): serve the browser's Wasm/glue alongside frontend assets.
- [Cloudflare TanStack Start integration](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/): preserve the existing Worker/Vite deployment path.
- [Cloudflare Wasm runtime](https://developers.cloudflare.com/workers/runtime-apis/webassembly/javascript/): a server Wasm integration would be a separate runtime adapter if needed later; it is not required for browser-local typing.
- [Ratatui rendering model](https://ratatui.rs/concepts/rendering/): the native host owns input/event-loop orchestration and drawing.
