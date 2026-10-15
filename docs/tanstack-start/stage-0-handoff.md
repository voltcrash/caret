# Stage 0 handoff

Completed phases **0.1 → 0.2 → 0.3**, in order. Stage 1 not started.
Baseline application: `d6e5be3e9`; initial worktree clean; no preceding-stage
prerequisite or handoff missing. Single PR; incremental commits retained.

Delivered:

- [Behavior/consumer inventory](behavior.md): routes/standalone aliases, URLs,
  OAuth/device/handoffs, downloads, admin/config/integrations/jobs, startup and
  preference ordering, account resets, navigation/test lifecycle, offline saves.
- [82-operation ledger](operations.json), generated from merged ts-rest contracts
  and actual browser callers. 47 web function targets; 35 retained HTTP targets,
  including 19 published public/ApeKey contracts. Uncertain operational/external
  usage conservatively retains HTTP; no product decision blocks foundation.
- [Baselines/validation](baseline.md): existing web/backend/real-D1/shared/browser
  suites pass; production fixture build and Worker dry-run pass; repeated eager JS,
  input/public-page readiness, rendering, real saves, Worker size/startup/local CPU
  and representative D1 statement counts; raw evidence and frozen numeric gates.
- [Architecture/compatibility](contract.md): unchanged target ownership, installed
  package facts and explicit Solid Query/Vite+/Cloudflare foundation proofs.
- [Release/rollback](release.md): observed production version/release/config,
  unchanged delivery path, coordinated artifact rollback and 30-day minimum old-tab
  window plus evidence-based transport retirement.
- Executable inventory drift/retention tests, budget rejection tests and browser
  navigate-away/back characterization. Production readiness uses server fixtures
  to preserve HTTP cache; Worker measurements run the compiled app in workerd/D1.

Moved files / removed legacy responsibility: **none in production**. Stage 0 owns
inventory/evidence; the architecture plan assigns app replacement to Stages 1–8.
No framework dependency, HTTP application entry, D1 migration, cookie, storage key,
production deployment, TUI source or scoring/typing-engine change was made.
Opt-in scripts/configs are test tooling; no replacement app wrapped around legacy.

Remaining adapters and retirement gates:

| Adapter | Retire when |
| --- | --- |
| Hono HTTP/controller/ts-rest/request objects | Extracted policy/services and equivalent native routes/functions pass Stage 2/3/6; production entry cutover Stage 7 |
| Ape/lazy contract clients/compatibility banner | All browser callers use functions or explicit HTTP protocols, old-tab window closes, Stage 6/8 |
| Page/PageWithUrlParams/controller/NavigationRuntime/AppPages/custom prefetch/active-page state | Native non-typing routes Stage 4, typing lifecycle Stage 5, final removal Stage 8 |
| Global auth/config startup, snapshot and module QueryClient/collections | Explicit request/app providers/factories and actor lifetime tests, Stage 2/5/6 |
| HTML injection/static SPA dispatch/prepare-site/PWA filename assumptions | Native document/assets and coherent Start build/Worker/offline contract, Stage 1/7/8 |
| Published/uncertain external HTTP endpoints | Keep protocol; only remove adapter implementation after equivalent Start server route tests |

Significant measurement adaptations: local fixed fixtures establish comparison
budgets; process-ready time and local workerd+D1 CPU are explicitly different
from Cloudflare edge startup/CPU. Actual deployment telemetry and release rehearsal
remain Stage 7 gates. Production test key is for local artifacts only. No
architecture deviation, destructive data change or failing required check accepted.

Next assignment: **Stage 1 only**. Start by rechecking ledger/worktree and pinning
compatible Solid Start/Router/generator/Cloudflare packages against installed
exports and official documentation. Prove native `/about` SSR, a direct real
server-function service read, Solid Query hydration/request isolation, same-origin
local D1/auth, fetch/queue/Cron, browser import protection, static fallbacks/CSP,
and the isolated build/CI gates. Do not copy React integrations or mount the old
application under a catch-all route. Preserve the legacy production rollback path.

Stage 0 unresolved phases/checks/product questions: **none**. Compatibility and
staging implementation gates listed above belong to their assigned later stage.
