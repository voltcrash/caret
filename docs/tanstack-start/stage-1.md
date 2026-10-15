# Stage 1: Start foundation

Base: Stage 0 `fde209446`, PR #135. Initial worktree clean; Stage 0 exit,
operation inventory, baselines, budgets and handoff verified before editing.

Phases run in order: 1.1 foundation → 1.2 invocation runtime → 1.3 document /
policy → 1.4 CI / production-like checks. Stage 1 currently in progress.

Responsibility moving: replacement document/layout, native `/about`, generated
route discovery, request-local router/Query, first direct service function,
Start HTTP dispatch, asset/header policy. Replacement imports no legacy bootstrap,
page controller or Hono application. Existing production delivery remains the
explicit rollback build until Stage 7. No TUI, storage/schema or scoring changes.

Pinned APIs: Solid Start 1.169.2, Router 1.170.41, generator 1.167.44,
Solid Router SSR Query integration 1.167.3, Cloudflare Vite plugin 1.62.0.
Cloudflare 1.62 supports existing Wrangler 4.146.0; 1.64 requires upgrading it.
Installed sources and official Solid Start/Cloudflare documentation reviewed.
The Solid SSR integration exists: use its QueryClientProvider and streaming
dehydrate/hydrate implementation; no custom React-derived adapter.

Validation and remaining adapters: pending phase completion; never a passing gate
until evidence is recorded here.
