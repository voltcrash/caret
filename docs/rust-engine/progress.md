# Rust engine migration progress

Implementation owner: sole agent; no delegation.
Starting commit: `7b1ae05f204be53b5d9f2714f21c6eea08b25935`.
Branch: `t3/rust-engine-migration`. Initial working tree clean.

## Delivery

Three PRs, stacked: Stage 1 engine → Stage 2 website → Stage 3 terminal.
Small commits at coherent behavior/build/documentation boundaries. Do not create
empty commits to inflate count. Do not publish production or releases implicitly.

## Current position

Stage 1, Phase 1.1 in progress. Read root AGENTS.md and the complete migration
plan before edits. Installed workspace dependencies with frozen lockfile.
No acceptance gate passed yet. Existing website engine remains authoritative.

| Phase | Status | Evidence / remaining gate |
| --- | --- | --- |
| 1.1 Inventory / baselines | Active | Core baseline: 28 files, 349 tests pass. Browser/performance baseline pending. |
| 1.2 Contracts / fixtures | Pending | Requires inventory and recorded baseline. |
| 1.3 Native / browser proof | Pending | Requires frozen contracts. |
| 1.4 Input / lifecycle / timing | Pending | Requires production browser proof. |
| 1.5 Generation / configuration | Pending | Requires contract and proof. |
| 1.6 Events / results / replay | Pending | Requires input and generation. |
| 1.7 Binding / engine gate | Pending | Full three-path parity and budgets. |
| 2.1–2.6 Website | Pending | Requires Stage 1 gate. |
| 3.1–3.5 Terminal | Pending | Requires Stage 2 gate. |

## Verification log

- `vp install --frozen-lockfile`: pass; 1,102 packages, lockfile unchanged.
- `vp test run --project=@oxytype/typing-core`: pass; 349 tests, 28 files.
- Environment: Linux, Node 24.21.0; installed Rust 1.99.1; GitHub CLI authenticated.
  Toolchain/binding pins not yet selected. Browser/OS support unverified.

## Decisions

- User's three-stage PR structure overrides the plan's suggested per-phase PRs.
- Browser rendering constraints (visible previous word, overflow) must be explicit
  host observations; Rust decides their rule effects. They cannot be discarded
  merely because headless TestSession does not model them.
- Preserve frozen snapshots. Record discrepancies; never regenerate to pass.

## Blockers

None established. Missing verification is pending work, not a passed gate.

## Resume

Read this file, inventory, contract, decisions, then `vp exec git status --short`.
Continue the first incomplete gate. Record commands and actual outcomes here;
do not rerun completed checks without a new reason.
