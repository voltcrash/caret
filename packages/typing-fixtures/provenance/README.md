# Archived capture sources

These are historical source records, not maintained reference engines. Captures
refuse overwrite and must only be run in their original checkout before migration.
CI compares Rust/native and browser Wasm directly with the immutable JSON output.

`capture-inspection-oracle.ts.txt`: executed with the original inspector at
`d49ab0e40`; source/output committed in `4377e1539`.
Recorded 64 prefixes across eight independent web logs. Original inspector helpers
were subsequently removed. The `.txt` source preserves provenance without importing
a retired runtime or keeping a TypeScript replay/statistics engine in CI.

`capture-synthetic-analysis.spec.ts.txt`: executed once at `24b3a3819` against
the unchanged 100-case frontend legacy statistics suite. Captures 67 unique public
analysis calls (arguments and original outputs), preserving synthetic cases beyond
the browser recordings. No frozen fixture was overwritten. Native
`synthetic_analysis.rs` compares every captured output exactly. The original suite
is available at that commit; this capture is inert provenance, never a maintained
TypeScript engine dependency.

`capture-string-rules.spec.ts.txt`: executed once before removing the frontend
string-rule re-exports. All 157 original string tests passed; captured 68 distinct
space/equivalence/character-count calls. `string_rules.rs` checks every original
result using Rust. Generic display/editor helpers retain their TypeScript tests.

`legacy-captures/`: original one-time capture tools from the retired package,
including the command oracle and baseline profiling script. Historical source
imports deliberately retain their original paths. Run only from the source commit
recorded by each immutable output / migration progress record. The entire original
TypeScript implementation and unit suites remain in Git at `1f69247bf`; they are
not installed, built or maintained after retirement.
