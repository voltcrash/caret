# Compatibility coverage map

Original references remain immutable, byte-for-byte copies with a SHA manifest. New captures are write-once; mismatch detection deliberately changes a word index and requires failure. No original snapshot was regenerated for the port.

| Contract | Implemented verification |
| --- | --- |
| Per-unit input, deletion, reset, finish | 19 frozen command traces; native and actual built Cloudflare Wasm |
| UTF-16 halves, combining text, typography | Unicode/input oracles; exhaustive Hangul unit hash; historical Unicode replay |
| IME / batch completion / deferred code tabs | Actual website characterization; native and Wasm observed-input contract |
| Firefox sentinel / visible bounds / overflow | Explicit preflight/delete observations; native and browser cases |
| Zero/infinite/fractional limits | Input/generation/fractional oracles; exact targets and RNG position |
| Generation / transforms / sections | 61 original generator snapshots, 99 transforms, section/live-generation captures |
| Quote queue / repeat / recovery | Explicit queue refresh RNG, retained quote identity, eight frozen recovery paths |
| Async source / stale generations | Native/browser initial and active failure, prefetch, reset/replacement, deferred input |
| Timer stalls / same-time reordering | Frozen timer traces, slow-render tests, delta invalidation regression |
| Stats / results / history / replay | Eight exact historical outputs; 1,387 live prefixes; persistent playback and seek |
| Transport schema / hashing | Built-Wasm CompletedEventSchema, eight frozen object-hashes, unchanged backend rejection |
| Physical observations | Repeat/NoCode/synthetic and estimated-release oracles; optional capability remains explicit |
| Shared policies / defaults | Generated Rust metadata/defaults; all funbox pairs/forced values; checked policy queries |
| Malformed boundaries / lifecycle | Bounded config/content/log validation; 128-seed, 12,800-command stress; stale/disposed handles |
| Memory / hot path / initialization | Recorded controlled-host budget checks; replacement and long-session growth soaks |
| Fresh-checkout / Cloudflare delivery | Automatic generated-output bootstrap; full website deployment/old-tab cutover gate remains Stage 2 |

Stage 1 proves the engine/binding. Stage 2 must rerun actual website behavior after integration, including settings imports/presets/URLs, authenticated/signed-out results, asset update/rollback and full website performance. Those host gates are not inferred from the proof component.
