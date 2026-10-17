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
| 1.1 Start foundation | Complete | [Stage 1](stage-1.md) |
| 1.2 One Worker, all invocations | Complete | [Stage 1](stage-1.md), workerd suite |
| 1.3 Document/assets/response policy | Complete | [Stage 1](stage-1.md), document suite |
| 1.4 CI and staging build | Complete | [Stage 1](stage-1.md), `ci-start`, browser suite |
| Stage 1 exit | Complete | [Stage 1 handoff](stage-1.md#next-stage-prerequisites) |
| 2.1 Factories/import boundaries | Complete | [Stage 2](stage-2.md), protection + layer suites |
| 2.2 Providers/browser runtime | Complete | [Stage 2](stage-2.md), owner/runtime suites |
| 2.3 Preferences/data identity | Complete | [Stage 2](stage-2.md), actor-isolation suites |
| Stage 2 exit | Complete | [Stage 2 handoff](stage-2.md#next-stage-prerequisites) |
| 3.1 Services/policies | Complete | [Stage 3](stage-3.md) |
| 3.2 Start policy adapters | Complete | [Stage 3](stage-3.md) |
| 3.3 Authentication flows | Complete | [Stage 3](stage-3.md) |
| Stage 3 exit | Complete, recorded byte deviation | [Validation and handoff](stage-3.md#exit-validation) |
| 4.1 Public routes | Complete | [Stage 4](stage-4.md) |
| 4.2 Settings/private routes | Complete | [Stage 4](stage-4.md) |
| 4.3 Navigation | Complete | [Stage 4](stage-4.md) |
| Stage 4 exit | Complete; intermediate Worker footprint recorded | [Validation and handoff](stage-4.md#exit-validation) |
| 5.1 Typing session/lifecycle | Complete | [Stage 5](stage-5.md) |
| 5.2 Browser integrations/URLs | Complete | [Stage 5](stage-5.md) |
| 5.3 Typing behavior/performance | Complete | [Stage 5 validation](stage-5.md#53-responsiveness-and-route-behavior) |
| Stage 5 exit | Complete; intermediate Worker footprint recorded | [Validation and handoff](stage-5.md#remaining-adapters-and-next-stage) |
| 6.1 Read models/collections | Complete | [Stage 6](stage-6.md#61-read-models-and-collections) |
| 6.2 Ordinary mutations | Complete | [Stage 6](stage-6.md#62-ordinary-mutations) |
| 6.3 Result submission | Complete | [Stage 6](stage-6.md#63-result-submission) |
| 6.4 Transport retirement | Complete | [Stage 6](stage-6.md#64-transport-retirement) |
| Stage 6 exit | Complete; old-tab/rollback lifetimes explicit | [Validation and handoff](stage-6.md#exit-validation) |
| 7.1 PWA/offline | Complete | [Stage 7](stage-7.md#71-offline-ownership) |
| 7.2 Delivery ownership | Complete | [Stage 7](stage-7.md#72-delivery-ownership) |
| 7.3 Production behaviour in staging | Complete | [Stage 7](stage-7.md#73-production-behaviour) |
| Stage 7 exit | Complete; production gated until Stage 8 | [Validation and handoff](stage-7.md#validation) |
| Stage 8 | Not started | Separate assignment |

Stage 0 moves responsibility for migration evidence from an unverified proposal
to this versioned ledger and reproducible checks. It moves no application
functionality; deletes no production transport, UI, storage or runtime code.
Installing Start or changing dispatch belongs to Stage 1, not this stage.

Record each later phase here: moved files, removed responsibilities, remaining
adapters with retirement conditions, tests/results and significant deviations.
Never treat a missing measurement as a passing gate.
