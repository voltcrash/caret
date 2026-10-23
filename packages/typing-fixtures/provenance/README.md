# Archived capture sources

These are historical source records, not maintained reference engines. Captures
refuse overwrite and must only be run in their original checkout before migration.
CI compares Rust/native and browser Wasm directly with the immutable JSON output.

`capture-inspection-oracle.ts.txt`: executed with the original inspector at
`d49ab0e40`; source/output committed in `4377e1539`.
Recorded 64 prefixes across eight independent web logs. Original inspector helpers
were subsequently removed. The `.txt` source preserves provenance without importing
a retired runtime or keeping a TypeScript replay/statistics engine in CI.
