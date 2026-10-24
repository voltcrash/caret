# Result save rejection: keyboard timeline

A read-only production audit query found one `anticheat_rejected` event at
2026-10-24 10:10:25 UTC: `key-timeline-mismatch`, time 15. The screenshot's
154 correct characters, 123.20 WPM and 15-second duration agree mathematically.
The original rejected payload was unavailable; its exact input sequence remains
unconfirmed.

## Reproduced engine defect

Rust retained a pre-start keydown for keyboard telemetry. Spacing and
`startToFirstKey` clamped its time to zero, while `lastKeyToEnd` used its negative
timestamp. With one retained keydown at -201ms and subsequent input without
keydown observations, a 15-second test reported 15201ms of keyboard time.
The backend correctly rejected that inconsistent payload.

`lastKeyToEnd` now uses the same zero origin as the other endpoints. Native
tests preserve observed hold durations and cover ordinary keys, absent keyboard
events and bailout trimming. A generated Wasm session reproduces the rejection
before the fix and passes the submission schema and backend integrity checks
afterward. Existing frozen result fixtures remain unchanged.

D1 coverage verifies that a normalized sparse result saves and increments
completed tests, while the same result with 201ms added is rejected without a
result write. The server's timing tolerance is unchanged.

Future timeline rejections record client, expected duration, first-key offset,
total spacing, final-key offset and key count. These numeric aggregates allow
diagnosis without retaining raw key events or full rejected payloads.

## Verification

- `vp run engine:test`
- `vp run engine:lint`
- `vp run engine:fmt`
- `vp test run frontend/__tests__/test/events/anticheat.spec.ts frontend/__tests__/test/events/result-integrity.spec.ts backend/__tests__/anticheat/keys.spec.ts backend/__tests__/anticheat/result.spec.ts`
- `vp test run backend/__tests__/d1/result-validation.spec.ts`
- `vp lint --type-aware --type-check --format agent frontend backend`

The Wasm build and frozen payload-size gate run automatically before Vitest.
