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
