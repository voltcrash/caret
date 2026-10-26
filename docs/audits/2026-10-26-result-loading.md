# Result save rejection during result loading

A read-only production audit query found a `key-timeline-mismatch` rejection
at 2026-10-26 12:40:52 UTC. Its 15-second test reported 15010ms duration,
0ms first-key offset, 15182.7ms total key spacing and 0ms final-key offset.
The keyboard timeline extended past the test end. This differs from the
pre-start endpoint bug documented on October 24.

## Reproduction and fix

Completion finalizes keyboard telemetry, then awaits result screen imports
before reading the event log. Keyboard listeners remain attached during that
wait. The engine accepted new keydowns after finalization, extending the log
past its end event. The final offset clamped to zero, so the server correctly
rejected the inconsistent timeline. Slow result loading increases that window;
the original full rejected log was not retained.

The engine now ignores new observations once completion is requested or the
test has ended. Releases for keys already held remain accepted, preserving
observed and estimated holds. Finalization drains outstanding keys, after
which keyboard events cannot modify the completed log. Reset enables
observations for the next test. Server checks and tolerances are unchanged.

Native coverage checks deferred/direct completion, outstanding releases,
estimated releases, repeated finalization, late observations and reset.
The real Wasm regression recreates the screenshot's 144 correct characters,
115.12 WPM and 15.01 seconds, then injects a key at 15182.7ms after cleanup.
It failed before the fix with `key-timeline-mismatch` at all three clock
origins (1 second, 1 hour and 1 day). After the fix, the completed log stays
unchanged and passes submission schema, server integrity checks and compressed
event-log replay.

## Verification

- Native typing engine and both Wasm binding crates: passed.
- Wasm result regressions, client/server integrity and D1 save validation:
  58 tests passed.
- Engine Clippy/formatting and frontend/backend type-aware lint: passed.
- Wasm generation and frozen payload-size gate: passed.

The full Rust workspace run fails in
`oxytype-tui/tests/portable_terminal.rs` before typing begins: the initial
letter color is `Default` instead of the expected RGB value. A fresh build
from an isolated archive of unchanged HEAD reproduces the same failure.
