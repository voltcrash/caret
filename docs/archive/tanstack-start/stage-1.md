# Stage 1: Start foundation

Base: Stage 0 `fde209446`, PR #135. Initial worktree clean; Stage 0 exit,
operation inventory, baselines, budgets and handoff verified before editing.

Phases completed in order: 1.1 foundation → 1.2 invocation runtime → 1.3
document / policy → 1.4 CI / production-like checks. **Stage 1 complete.**
Stage 2 not started.

Responsibility moved: replacement document/layout, native `/` shell and
`/about`, generated route discovery, request-local router/Query, first direct
service function, Start HTTP dispatch, asset/header policy. Replacement imports
no legacy bootstrap, page controller or Hono application. Existing production
delivery remains the explicit rollback build until Stage 7. No TUI,
storage/schema, cookie, D1 migration or scoring changes.

Pinned APIs: Solid Start 1.169.2, Router 1.170.41, generator 1.167.44,
Solid Router SSR Query integration 1.167.3, Cloudflare Vite plugin 1.62.0.
Cloudflare 1.62 supports existing Wrangler 4.146.0; 1.64 requires upgrading it.
Installed sources and official Solid Start/Cloudflare documentation reviewed.
The Solid SSR integration exists: use its QueryClientProvider and streaming
dehydrate/hydrate implementation; no custom React-derived adapter. Seroval
pinned to the version exporting the streaming serializer Start imports.

## 1.1 Start foundation — complete

- `frontend/vite.config.ts` now builds Start (Cloudflare `ssr` environment,
  Solid SSR, Tailwind, `static/` public dir, `envPrefix: []`, import protection:
  backend specifiers/files rejected from client, legacy bootstrap/test/`*.client`
  rejected from server). Previous config moved verbatim to
  `vite.legacy.config.ts` (production rollback; `build`, `dev:legacy`, legacy
  Playwright and migration benchmarks use it).
- Entries: `src/router.tsx` (factory, one router + QueryClient per request),
  `src/start.ts` (service-context + serverFn CSRF middleware), `src/server.ts`,
  `src/worker.ts`. Routes: `__root` (document, head, not-found/error),
  `_app` layout, `_app.index`, `_app.about`, `404[.]html`,
  `oauth-callback[.]html`, `api.auth.$`. Generated `routeTree.gen.ts` committed;
  route IDs/literal-dot escaping proven by generator test.
- Local dev: `vp dev` = one Start/Cloudflare process with same-origin functions,
  auth and D1 (persisted in existing `backend/.wrangler/state`); verified
  `/about` SSR reads local D1, `/api/auth/get-session` 200, unknown URL 404.
  `dev:offline` (`--mode offline`) skips server reads; verified renders `-`.
- Query hydration: `setupRouterSsrQueryIntegration`; only `meta.ssrSafe`
  successful queries dehydrate.

## 1.2 One Worker, all invocation types — complete

- `createApplicationWorker` wraps fetch/queue/scheduled in `withRuntime`;
  queue/scheduled call existing `consumeBatch`/`scheduled` jobs.
- Backend boundaries: `auth/handler.ts`, `policies/{client-ip,ip-key,
  rate-counter}.ts`, `services/public.ts`; Hono routes/middleware reuse them.
- `getTypingStats` server function → `readTypingStats` policy (root +
  `publicStatsGet` rate limits, trusted IP, safe 500) → D1 service; SSR uses the
  same path. `/api/public/typingStats` (legacy HTTP) is not mounted: 404.
- workerd suite (`worker.spec.ts`): real RPC + origin protection + 429,
  SSR D1 read with per-binding cache isolation, distinct real sessions,
  cross-origin auth writes rejected, queue + scheduled with D1, concurrent
  streamed responses keep actor/binding/`waitUntil` after return.

## 1.3 Document, assets, response policy — complete

- `app/document.tsx` emits `html/warnings.html` (`noscript`, `#nocss`) in the
  initial HTML; its `<script>/<style>` get the request nonce.
- Response policy: `no-store` HTML, request ID, nosniff, frame/referrer,
  HSTS (non-dev), CSP with per-request nonce, no `unsafe-inline` scripts, single
  `script-src-attr` hash for the fallback's `onclick` (test recomputes it).
  `_headers`: immutable `/assets/*`. Body bound 100 KiB (413) before dispatch.
- Fonts, theme CSS, icons, `manifest.start.webmanifest`, route titles,
  canonical/OG metadata. `public-env.ts` is the browser allowlist; secrets
  only from bindings. Root errors render without DB/secret details.

## 1.4 CI and staging build — complete

- CI job `ci-start`: Start + runtime-test builds, Worker dry-run, SSR/workerd/
  bundle suites, production-Worker browser checks, migration staging build +
  dry-run. Existing legacy jobs unchanged.
- `wrangler.jsonc` env `migration`: Worker `oxytype-start-migration`, own
  origin and queues, staging D1 (jobs/outbox are lease-claimed, so a second
  dispatcher is safe). `build:start:staging`. Not deployed (needs queue
  creation + secrets; outward-facing; Stage 7.3 exercises it).
- Browser (`start-e2e`, built Worker in workerd): direct load, hydration with
  zero RPC, native navigation (one document request), refresh, no-JS fallback,
  CSS failure → recovery under production CSP, 404 status, popup callback URL.
- Bundle boundary test: server markers present in server bundle, absent from
  client JS; legacy bootstrap literals absent from both Start bundles.

## Validation (final branch head)

| Check | Result |
| --- | --- |
| `vp run lint-fe` / `lint-be` / `lint-pkg` | pass |
| `vp run test-fe` / `test-be` / `test-pkg` | pass |
| `vp run build` (CI env) | pass |
| `vp run test-e2e` | 31 pass (after flake fix below) |
| `vp run knip` / `lint-styles` / `check-assets` | pass |
| `vp fmt frontend/src backend/src --check` | pass |
| `build:start`, `build:start:test`, `dry-run:start` | pass |
| `test:start` (foundation, worker, document, bundle) | 4 files / 16 tests pass |
| `test:start:browser` | 4 pass |
| `build:start:staging` + dry-run | pass |
| `measure-eager-js` (baseline env) | raw 922,918 = budget; gzip +42 B |

Pre-existing failure: `e2e/migration-characterization.spec.ts` failed 4/5 at
`fde209446` (legacy runtime reverts Back during page transition/load). Test now
retries Back until the test page returns; 10/10 pass. No legacy source changed.

New failures found and fixed during the gate: stylelint `@import` order in
`app/app.css`; madge type-only cycle via generated route tree (excluded);
knip lost legacy entries once Start owned `vite.config.ts` (declared); root
formatter config lacked the generated route tree ignore.

## Deviations

- Rollback eager JS: raw bytes identical; gzip +42 B from the embedded
  per-commit client version stamp only. Rollback Worker `worker.js` +519 B raw
  (0.011%) from the shared auth/policy/service extraction; gzip under budget.
  Stage 0 budgets left unchanged.
- Start rate limits use `start:<operation>:<ipKey>` counters, separate from
  legacy `<operation>:<actor>`. Unify when the operation's HTTP adapter retires.
- `/` is a static SSR shell; typing route is Stage 5. `/privacy-policy.html`
  stays legacy until Stage 4. Start manifest is separate until Stage 7 PWA.

## Remaining adapters

| Adapter | Retire when |
| --- | --- |
| `vite.legacy.config.ts`, legacy SPA, Hono production Worker | Stage 7 delivery transfer; Stage 8 deletion |
| `oauth-callback[.]html` renders legacy standalone `OAuthCallback` | Stage 3/4 auth/page migration |
| `manifest.start.webmanifest` beside legacy manifest/PWA | Stage 7 offline contract |
| Separate `start:` rate-limit namespace | Operation's legacy HTTP retired (Stage 3/6) |
| `__tests__/start/worker-entry.ts` (runtime-test build only) | Kept as test fixture |

## Next stage prerequisites

Stage 2 may start: Start entry, request-local router/Query factory, direct
service path, Worker invocation runtime and CI gates are in place. Stage 2 must
keep `ci-start` green, keep backend imports behind `*.server.ts`/import
protection, and convert legacy module-level stores before SSR reaches them.
Re-estimate allowed now that foundation and SSR/runtime checks are complete.
