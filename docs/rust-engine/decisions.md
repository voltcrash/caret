# Migration decisions

- Sole implementation owner; three stacked stage PRs, as requested.
- Text boundary uses UTF-16 unit arrays. Rust String cannot preserve an isolated
  surrogate; unit arrays avoid a lossy JSON string roundtrip and work natively.
- Keep original fixtures during Stage 1; neutral reference package holds exact
  copies, checked by SHA-256. Removal of old package waits for Stage 2 gate.
- Record web/headless differences in contract. Headless session is an oracle for
  matching cases, not permission to change browser behavior.
- Use installed Rust 1.99.1 as candidate pin. Confirm target/tool compatibility
  before finalizing Phase 1.3; no lower MSRV support claimed without a build.
- Offline terminal initial scope excludes accounts/sync. Publication follows
  repository release authorization; no production deployment implied by this task.
- Korean scoring preserves hangul-js 0.2.6 disassembly, including its NUL→ㄱ
  lookup quirk. An exhaustive frozen digest covers every UTF-16 unit. Correcting
  that legacy interpretation requires a separately versioned behavior change.

## Stateful quote selection and generator bounds

Quote queues belong to an explicit `Quotes` instance; loading the same language preserves the queue, matching the original controller. Changing selected lengths requires explicit `update_queue`, as on the website. Original generator fixtures share one controller across cases; the Rust harness preserves this lifecycle rather than resetting or regenerating snapshots. All 61 run without exclusions. Polyglot assets are host supplied; Rust merges/deduplicates in JS Map order, shuffles, and retains per-word language properties. Direction conflicts and insufficient valid assets currently return errors; final binding must project the existing host recovery actions before cutover.

Pseudolang retains UTF-16 prefix and JS property enumeration semantics. Its legacy unbounded loop is bounded at 65,536 draws with an explicit error; no random fallback. Individual source words and generation requests are bounded at 1,000,000 UTF-16 units/words. Hosts must surface failures; never silently alter generated content.

`accents.json` and `british-english.json` are mechanical copies of existing GPL-3.0 project transformation tables, not regenerated reference snapshots. Morse uses a compact immutable mapping mechanically captured from the original Node 24 / Unicode 17.0 algorithm. The native exhaustive oracle covers every Unicode scalar and every isolated UTF-16 unit (1,182,044 output units, digest cbd60b424acd4b15). This preserves normalization behavior without bundling unrelated Unicode normalization tables.

## Browser progression precedes commit failure

Actual built-Cloudflare browser tests show both master and minimum-burst failures advance the word before finishing when the input commits it. The headless oracle checks failure first. Rust follows the website: advancement precedes failure checks, while burst is calculated for the committed word. `browser-contract-overrides.json` explicitly classifies the one existing min-burst frame whose state differs; its original bytes stay unchanged and tests assert the original state before comparing the separately recorded browser state. Input events and scores retain exact equality. No score rule changes.

## Section request ordering

One outstanding section request per generator, with at most 16 prefetched sections. Background prefetch does not disable typing while already prepared words remain. At exhaustion, preserve the current commit and its bounded remaining UTF-16 batch; reject new insertion/deletion until a matching response arrives. Generation and input timestamps remain stable. Reset/end cancel requests. Resume-time completion uses the reply's explicit monotonic and wall-clock timestamps, matching the browser's post-await finish ordering. This replaces the old possibility of concurrent, out-of-order section fetches with explicit ordering as required by the migration contract; the browser adapter must not start duplicate requests.

## Selected command serialization

Archived native/browser measurements compare incremental object conversion and JSON (proof-performance.json, profile-z-proof-performance.json). JSON is faster at the frozen 200-unit workload. Retire the benchmark-only object facade and serde-wasm-bindgen conversion dependency after the expanded 13-test browser parity pass; production uses one synchronous JSON interface. Keep original measurement evidence. Deployed glue is the minified Vite asset containing generated glue and the host facade (15,975 bytes at the policy checkpoint); generated development-source comments are not transferred. Numeric budgets remain unchanged.

### Fractional-limit capture harness correction

Before the fractional Rust port, the first new capture accidentally preloaded the generator through the shared oracle's units helper, pinning the host RNG before seeding. It also supplied a constant zero host word count. Preserve that diagnostic unchanged at diagnostics/fractional-capture-before-harness-fix.json; it is not a parity reference. The corrected standalone capture defines UTF-16 conversion locally, imports the original generator after seeding, and tracks returned host words. Its new write-once reference is fractional-limits-v2.json. No existing reference/snapshot was regenerated, and this harness correction precedes the engine implementation.

### Browser final-word batch observation

Before connecting the Rust loop, the existing built TypeScript website recorded
`one extra` against the finite custom target `one` (normal difficulty). Capture:
`frontend/e2e/engine-input-observations.migration.ts`; immutable output:
`packages/typing-fixtures/oracle/browser-final-word-batch.json`. All nine input
observations share the original batch time. Committing clears the textarea even
when the last target cannot advance; the next event retains the prior log's
character index but records the freshly cleared DOM input. Rust now owns this
distinction and exposes an optional empty `inputDisplayValue` projection. State
and event-log input remain unchanged for existing fixtures. No reference updated.

Browser batches are split only to observe layout between UTF-16 units. Target
normalization/expansion come from native preflight, using the same expansion rule
as native insertion; the browser provides `finalInBatch` for completion policy.

### Catalog reads share native quote ownership

Quote search/report previously shared the generator's catalog/queue object. The
new raw asset host delegates catalog grouping and cache mutation to the same Rust
content resource. A catalog read with no explicit length selection preserves an
already-built queue, including old-language quote objects. Selecting a quote
normalizes its stored text/language/textSplit, which remains visible to catalog
readers. Preserve both effects; separate UI selectors must not reseed a queue.

Original TypeScript captures are write-once `quote-catalog-v2.json` (catalog/queue
ordering and RNG state) and `quote-catalog-selection.json` (selected-object
normalization). The first catalog capture imported pinned RNG helpers before
installing its deterministic stream; retain its bytes as
`diagnostics/quote-catalog-unseeded.json`, classify it as a diagnostic, and use the
separately named corrected capture. No fixture regenerated for a port mismatch.

The binding sends catalog reads through the existing prepared-asset envelope;
only quotes/random/quote lengths participate. Catalog groups are native indices
into returned quotes; the UI mechanically projects these into object arrays.

### Binding optimization after catalog coverage

The unoptimized size boundary correctly rejected catalog additions at 308,493
bytes gzip6 (and later 307,784 after serializer sharing). Frozen 307,200-byte budget
unchanged. Pinned Binaryen `-Oz --converge` reaches a smaller fixed point; an
isolated candidate measured 772,919 raw / 305,790 gzip6. Build/cache reuse still
checks the original limits. Current-head browser parity and recorded final website
performance remain required; the optimizer experiment alone is not that evidence.

The proof route skips app policy preloading so cold initialization probes remain
cold. Normal browser routes preload the app-owned engine concurrently with local
preferences/themes; engine-dependent funbox controls wait for policy readiness.

### SSR-safe web helpers and policy readiness

Extract settings migration, themes, preference metadata/order to `web-shared`.
Engine defaults are generated Rust fields; preserve web default field enumeration
order because imports apply dependent preferences in that order. Browser funbox
eligibility calls native policies; no browser initializer enters server imports.
Full constrained config application waits for Rust before mutating settings.
Failed local startup preserves the saved config for Restart and does not persist
partial defaults. Empty selections have no constraints and permit theme/preference
bootstrap independently. Tests retain existing cold-import timeout; limit local
concurrent workers when CPU-heavy production builds compete for the same host.

### Native historical inspection and display-only non-finite bursts

Expose inspection separately from completed scoring so partial logs preserve
unreleased zero-duration placeholders and original inspector DOM snapshots without
requiring a completed timer. Inspector word position is the original last input
position; session/replay Frame active position retains its separate contract.
Factor existing native timing/accuracy scans; no scoring formulas change.

Per-word burst can be positive infinity in the original engine. serde_json emits
null; generated types declare that wire representation explicitly, and the host
restores Infinity only for presentation. Completed metrics retain strict finite
validation. Do not allocate an intermediate Option array solely for JSON conversion.
Historical capture sources that refer to removed functions are archived as inert
text; parity CI runs directly against immutable outputs without the old engine.


### Terminal scope and merge gate superseded by owner

After merging PRs #184/#185, the owner explicitly requested Linux/macOS only,
Kitty-compatible terminal coverage, and PR #186 ready for merge. Windows is removed
from release targets and verification requirements; historical CI evidence remains
an immutable record of earlier scope. Linux/macOS Intel/ARM64 are the four targets.
The owner will verify macOS manually after merge; recruiting external testers is
not a pre-merge requirement. Automated native/archive and real Linux emulator
checks govern merge readiness. Unperformed macOS/IME checks stay pending and are
not reported as passed. Release publication remains separately authorized/gated.
The application renders text; Kitty graphics support is independent of keyboard
protocol support, negotiated without terminal-brand or TERM-name assumptions.

Linux's former manual/contributor gate is replaced by required real-emulator CI;
macOS is the sole manual publication gate, owned by the user after merge. The
publisher depends on native builds, both Linux emulator jobs and corresponding
source, then checks the nonempty macOS record. Physical Linux IME/font inspection
remains explicitly unperformed; it is not an implicit external tester requirement.

### Minimal Kitty keyboard enhancement

Real Kitty 0.32.2 emits duplicate legacy Backspace deliveries when release reports
are requested. The app only needs key disambiguation; auto now requests flag 1,
leaving text/IME on ordinary UTF-8. It does not request event types/all keys/text
association. Repeats remain one insertion per delivery; unobserved event kinds
remain false/null in history. Explicit release/repeat wire fixtures still verify
correct handling if such packets arrive. Core input/scoring rules are unchanged.
