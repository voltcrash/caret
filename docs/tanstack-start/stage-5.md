# Stage 5: native typing route

Base: Stage 4 `2a66d1577`, PR #139; clean working tree, ledger and handoff
verified. Work stays on one child branch/PR, with small commits. Production
rollback remains available. No TUI or Stage 6 transport migration.

## Prerequisites and responsibility map

Stage 4 completed all phases and exit checks; native index is the remaining
placeholder. Stage 5 moves typing orchestration, input/rendering integration,
route entry/exit and URL startup into `features/typing`. Start must never import
AppPages, Page, page-controller or NavigationRuntime. Engine algorithms,
telemetry, save transport and authentication policies stay unchanged.

Phases run in order: 5.1 lifecycle → 5.2 integrations/URLs → 5.3 validation.
Status: 5.1 in progress; 5.2/5.3 pending. Required checks pending.
