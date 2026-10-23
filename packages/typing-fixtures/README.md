# Typing reference fixtures

`reference/` is a byte-for-byte copy of `packages/typing-core/__fixtures__/` at
`7b1ae05f204be53b5d9f2714f21c6eea08b25935`. Preserve original files and provenance;
never regenerate these snapshots to make a new implementation pass.

`commands/` holds explicit config/content/time/command traces. Text fields are
UTF-16 unit arrays, permitting isolated surrogate halves. `oracle/` holds frozen
TypeScript output at every command. New captures refuse to overwrite output.

See `docs/rust-engine/contract.md` and `reference-manifest.json`. Fixture schemas
remain data contracts, independent of either engine implementation.

The legacy engine package was removed in Stage 2. `reference/` is now the sole
fixture location. The unchanged historical manifest retains original path names
for provenance; the integrity test maps those paths to this directory. Native
tests and built browser Wasm compare against frozen outputs directly. One-time
capture sources are archived as inert `.txt` files in `provenance/`.
