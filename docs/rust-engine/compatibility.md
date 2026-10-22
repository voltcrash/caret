# Compatibility coverage map

Never regenerate existing reference snapshots. New oracle traces were captured
once from the unchanged TypeScript session; capture refuses existing output.

| Contract | Reference / additional required verification |
| --- | --- |
| Per-unit commits, edits, finish/reset | commands/finite-edit; existing session tests |
| Isolated UTF-16 halves, combining marks | commands/unicode-halves |
| IME metadata, typography/space normalization | commands/ime-typography; browser IME characterization required 1.4 |
| Backtracking | commands/freedom-regression; Firefox clearedNextWord browser case required 1.4 |
| Automatic code tabs/unindent | commands/code-indent; deferred browser task ordering required 1.4 |
| Timer stalls and finish/reset races | commands/timer-stall; existing timer specs |
| Infinite limits | commands/infinite-words; timed/zen zero-limit cases required 1.4 |
| Error policies | commands/delete-error-*; stop-letter; master-finish-once |
| Generation / random consumption | reference/generator + 61 existing snapshots; connect native/Wasm at 1.5 |
| Scores, hashes, history, replay | reference/keystrokes + snapshots; original frontend characterization at 1.6 |
| Backend rejection behavior | reference/anticheat; backend/__tests__/anticheat |
| Browser-only DOM/composition behavior | frontend/__tests__/input; e2e/migration-characterization; expand for recorded differences in contract |
| Transport schema | packages/schemas/src/results.ts; mechanical binding/CompletedEvent check at 1.6–1.7 |
| SSR and immutable asset pairing | Start delivery/update suites at 1.3 and 2.5 |

These are classified gaps, not coverage claims. Phase 1.2 freezes the comparison
mechanism; later phases must fill their respective gaps before their gates pass.
The deliberate-mismatch test changes the first word index and requires comparison
to fail; fixture-integrity test checks every original and copied file hash.
