# Performance and reliability checks

This pass removes repeated work in typing feedback, quote search and local
persistence. It does not promise constant latency across devices, networks or
arbitrary input sizes.

## Covered limits

- Caret updates with the same frame ID retain one browser animation request and
  the latest callback. Cancellation, app disposal and scheduling from inside a
  callback remain covered.
- An audio sample retains at most one playback request while loading. Stop
  discards it; unload cancels that sample's download without aborting the owner.
  Decoded sounds still support rewind and overlapping playback.
- Account cache persistence ignores observer activity and fetch-status changes.
  Queued saves skip already-persisted revisions, retain updates made during a
  write, retry failures, and preserve serialized sign-out clearing.
- File-existence checks read IndexedDB keys, not uploaded data URLs. Blocked
  upgrades close the connection; terminated connections reopen on next use.
- Settings writes reuse the previous serialized value, while preserving failed
  write retries and schema validation.
- Quote search bypasses exact-match edit-distance matrices, rejects impossible
  length matches before matrix allocation, and filters IDs through a Set.
  Ranking, stemming, typo boundaries and prototype-named words have regressions.

## Reproduce

From the repository root:

```sh
vp test run frontend/__tests__/app/animation-frames.spec.ts frontend/__tests__/app/audio-samples.spec.ts frontend/__tests__/app/query-cache.spec.ts frontend/__tests__/app/file-storage-owner.spec.ts frontend/__tests__/utils/local-storage-with-schema.spec.ts frontend/__tests__/utils/search-service.spec.ts
vp -C frontend test run
vp -C frontend lint . --type-aware --type-check --format agent
vp run build
vp run knip
```

The browser suites exercise real Chromium animation scheduling callers and
Web Audio decoding/rendering. Focused scheduling, disk and network assertions
use spies or deferred operations to reproduce bursts and failures deterministically.
These checks verify avoided work and behavior, not end-to-end latency targets.
