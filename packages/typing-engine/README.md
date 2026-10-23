# Browser engine bindings

Platform-independent rules live in `crates/typing-engine`; this package contains generated declarations and a thin synchronous JSON adapter. The production website continues using its existing engine until Stage 2.

## Build and verify

From the workspace root:

```sh
vp install --frozen-lockfile
vp run engine:build
vp run engine:parity
vp run engine:fmt
vp run engine:lint
```

Pinned Rust/tool versions are in `rust-toolchain.toml`, Cargo manifests/lockfile and `scripts/engine.ts`. Install the pinned Rust toolchain with its wasm32 target. The builder installs the matching wasm-bindgen CLI when necessary and invokes pinned Binaryen. Ignored output regenerates in development, production, CI, direct type-aware lint and tests. Source/output hashes protect the build cache. Generated files publish after compilation/optimization; concurrent process locking is not promised.

## Browser ownership

Dynamically import `@oxytype/typing-engine/browser.client` inside the browser lifecycle. Create `createEngineLoader()` under the app/route owner; register cleanup before awaiting `loader.load()`. The loader shares concurrent initialization within that owner, aborts pending loading on disposal and permits retry after download failure. Initialization checks the binding version before returning a usable engine.

`Engine` creates independent `BrowserContent`, `BrowserSession` and `BrowserReplay` handles. Dispose every handle on replacement/route cleanup; `dispose()` is idempotent and subsequent operations reject with `EngineFailure.code === "disposed"`. `Content.recycleSession(session)` consumes the session and retains only generator repetition, quote identity, weak-spot learning and remembered pace. Independent content owners retain independent state.

The host fetches language/quote/section assets and calls `content.prepare`. `createSession` transfers generated content to the session. Generation may return a structured content request; supply the exact token or report explicit source failure. Generations invalidate old replies after reset/replacement. Live `configure` preserves prepared assets/RNG/learning while applying rule reads at subsequent generation boundaries. Source/mode replacements use preparation and host lifecycle policy. Call `updateQuoteQueue` explicitly when quote-length preferences change; cached-language preparation preserves the existing queue. Pass/retain its returned random state to preserve random consumption.

After asynchronous loading, commands and queries are synchronous:

```ts
const update = session.command({
  op: "insert", data: encodeText(committedText), now, date,
  correctShiftUsed: null, automatic: null, isCompositionEnding: null,
});
```

The host supplies monotonic milliseconds and separate wall-clock metadata. Preserve captured input times through asynchronous content loading. The host owns beforeinput/input reconciliation, composition lifecycle, focus, DOM/caret/audio and timer scheduling. Rust owns acceptance, normalization, progression, scoring and completion. Optional physical observations are separate from committed text.

Consume `Update.state`, changed words and ordered events. Read `snapshot()`/`log()` explicitly. A log accumulator refreshes when `logInvalidated` is true (reset/finalize, rebased origin or timestamp/rank reordering). `liveStats(now)` reads cached WPM/raw/accuracy/characters/clock/spacing without copying the log. `pace`, `restartPolicy`, shared `policy` queries and typed `analyzeLog` provide supporting rules. Deferred finish requires acknowledgement at the actual observed completion time.

`EngineFailure` carries a stable code, display message, cause and ordered typed recovery actions. Empty messages can accompany explicit notices. Source I/O failure requests recovery without creating a typing-score failure. Corrected preparation can retry; an active failed source blocks further input/ticks until lifecycle recovery.

## Text, historical logs and results

`Text` is an array of UTF-16 units, including isolated surrogates. `encodeText`/`decodeText` preserve JavaScript positions; Unicode scalars/graphemes/terminal columns are different units. SSR-safe `@oxytype/typing-engine/text` converts legacy logs and preserves optional/extra metadata. Rust validates log shapes/versions/bounds at analysis/playback entry points.

Generated events discriminate input/key/timer/composition payloads. Result/chart/custom/incomplete DTOs are generated from Rust; web Zod schemas remain authoritative for submissions. Add account/tags/challenge/transport fields and hash with the existing object-hash helper at the transport boundary. Backend auth/integrity/anticheat remains independent. Native offline history uses its own capability-aware local envelope rather than a web account submission.

`BrowserReplay` owns playback cursor/prompt; step returns word deltas/sound/next time, seek returns a snapshot. Hosts schedule and render. Historical UTF-16 indexing quirks stay versioned and unchanged.

See `docs/rust-engine/contract.md`, `features.md`, `progress.md` and performance artifacts for exact compatibility decisions, bounds and remaining gates. Wasm linear memory retains its high-water allocation after disposal/reset; the frozen 2,000-unit reset budget and longer growth/ownership soaks are reported separately.
