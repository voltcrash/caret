# Migration ledger

Stage 0 baseline commit: `d6e5be3e9`. Working tree initially clean.
No preceding implementation stage or handoff exists. Prerequisite: merged
[architecture plan](../TANSTACK_START_MIGRATION.md), read in full before changes.

| Phase | Status | Evidence |
| --- | --- | --- |
| 0.1 Behavior/consumer inventory | Complete | [Behavior](behavior.md), generated operations ledger |
| 0.2 Repeated baselines/budgets | Complete | [Measurements, budgets, checks](baseline.md) |
| 0.3 Architecture/release contract | Complete | [Compatibility](contract.md), [rollback/old tabs](release.md) |
| Stage 0 exit | Complete | [Handoff](stage-0-handoff.md); no unresolved required checks/product questions |
| Stages 1–8 | Not started | Separate assignments |

Stage 0 moves responsibility for migration evidence from an unverified proposal
to this versioned ledger and reproducible checks. It moves no application
functionality; deletes no production transport, UI, storage or runtime code.
Installing Start or changing dispatch belongs to Stage 1, not this stage.

Record each later phase here: moved files, removed responsibilities, remaining
adapters with retirement conditions, tests/results and significant deviations.
Never treat a missing measurement as a passing gate.
