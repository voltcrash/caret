# TanStack Start migration: architecture and execution plan

Status: Stages 0–5 complete; [ledger and handoffs](tanstack-start/README.md).
Stage 6 not started. Production still serves the legacy app (rollback build).
Prepared: 2026-10-15. Scope: Oxytype web application and its server/runtime.

## Outcome

TanStack Start becomes Oxytype's application framework: document rendering,
routes, layouts, navigation, data loading, server functions, server routes, and
web delivery. The existing page controller and navigation runtime disappear.

This is an architecture migration, not a typing-engine rewrite or UI redesign.
Preserve existing product behavior unless a phase explicitly records a change.
TUI development, compatibility work, and TUI acceptance testing are outside scope.
Do not delete TUI source or historical client data as part of this migration.

## Decisions and boundaries

- Keep SolidJS, Tailwind, `class`, `cn`, `Fa`, TanStack Query/DB/Form/Table,
  Better Auth, Drizzle/D1, Cloudflare Queues/Cron, and the headless typing core.
- Keep workspace names `frontend/` and `backend/`. Make `frontend/` the Start
  application and deployment owner; make `backend/` a server-only service package.
  Avoid a simultaneous repository-wide naming migration.
- Use Start's file-based routes and ordinary route mounting. No second router,
  catch-all legacy app, or hidden permanently mounted collection of pages.
- Use selective SSR: render the document/shared shell and useful public content
  on the server; mount the typing engine and browser integrations on the client.
  SPA mode may be a foundation milestone, not the final rendering architecture.
- Use server functions for first-party web reads/mutations. Use server routes for
  Better Auth, retained external HTTP APIs, downloads, and integrations.
- Call backend services directly from Start handlers. No internal HTTP round trip
  to the existing Hono API and no manufactured legacy request objects as the end state.
- Preserve real external API contracts discovered in Stage 0. Keeping an endpoint
  for a documented external consumer is separate from preserving TUI compatibility.
  Web-only endpoints can be retired after their callers migrate.
- Keep the existing production origin, cookie identity, D1 data, queues, Cron
  schedules, scoring rules, and result deduplication semantics.
- Use `vp` throughout. Typechecking uses `vp lint --type-aware --type-check
  --format agent`; no `tsc` migration workflow.

## Target architecture

### Runtime and request flow

```text
Browser
  Start/Solid routes + layouts
    ├─ Query: remote data/cache
    ├─ DB collections: browser-owned history and local derived queries
    ├─ app providers: preferences, auth observation, overlays, typing session
    └─ typing route: input, words, caret, audio, timer, result rendering
             │ same-origin server-function / HTTP requests
Cloudflare Worker entry
    ├─ fetch → invocation runtime → Start handler
    │            ├─ document SSR / route requests
    │            ├─ server functions → policy → backend services
    │            └─ server routes → auth / external HTTP adapters → services
    ├─ queue → invocation runtime → existing job services
    └─ scheduled → invocation runtime → existing job services
                                            │
                          DAL + transactions + anticheat
                                            │
                                     D1 / Queues / assets
```

One production application Worker owns the origin. Start owns HTTP application
dispatch; the Worker entry also exports Cloudflare queue/scheduled handlers.
Cloudflare's asset integration serves generated client files and curated static
assets. The old Hono application is a transitional transport, not the production
application entry after cutover.

Initialize the existing `withRuntime(env, ..., ctx)` once for each fetch, queue,
or scheduled invocation. Preserve its invocation isolation. Start middleware
derives a typed service context from that runtime and the incoming request:
database/runtime access, validated actor/session, configuration, trusted client
IP, request ID, and background-task capability. Do not create competing mutable
global contexts. Account identity and permissions always come from server checks.

### Proposed source layout

```text
frontend/
  src/
    routes/                       # route declarations, loaders, head, boundaries
      __root.tsx                  # document, providers, static fallbacks
      _app.tsx                    # common application layout
      _app/index.tsx              # / typing
      _app/about.tsx
      _app/leaderboards.tsx
      _app/settings.tsx
      _app/login.tsx
      _app/device.tsx
      _app/profile/index.tsx      # /profile search
      _app/profile/$uidOrName.tsx # /profile/:uidOrName
      _app/_authenticated.tsx    # pathless private layout
      _app/_authenticated/account.tsx
      _app/account-settings.tsx   # legacy redirect
      privacy-policy[.]html.tsx   # preserve /privacy-policy.html
      404[.]html.tsx              # preserve standalone URL; return HTTP 404
      oauth-callback[.]html.tsx   # preserve popup callback URL
      api/auth/$.ts              # Better Auth HTTP delegation
      api/...                    # explicitly retained external endpoints
    app/
      document.tsx
      layout.tsx
      providers.tsx
      browser-runtime.tsx        # component-owned browser initialization
      query-client.ts            # factory, not shared SSR instance
      public-env.ts              # explicit browser-safe values only
    features/
      typing/                    # route UI, session owner, client runtime
      account/
      profile/
      leaderboards/
      settings/
      auth/
      ...                        # remaining product capabilities, moved as used
    components/                  # shared UI, layouts, overlays
    data/                        # query options, keys, browser collection factories
    functions/                   # narrow createServerFn transport definitions
    server/
      context.server.ts
      middleware/               # HTTP and server-function policy adapters
      auth.server.ts
    router.tsx                   # factory; one instance per SSR request
    start.ts                     # request middleware and Start configuration
    server.ts                    # Start server entry
    worker.ts                    # Cloudflare fetch + queue + scheduled entry
    html/warnings.html           # preserved static fallback source
  static/                        # existing assets; configured as public directory
  wrangler.jsonc                 # deployment owner after Stage 7
  wrangler.production.json
backend/
  src/
    services/                    # application operations; transport-independent
    policies/                    # reusable auth/permission/rate/config rules
    dal/                         # persistence access
    db/                          # Drizzle schema, queries, atomic writes
    auth/                        # Better Auth construction and server behavior
    anticheat/
    jobs/ + queues/ + runtime/   # retained non-HTTP infrastructure
    api/                         # temporary legacy adapters; remove as retired
  migrations/ + bootstrap/       # keep migration history and database ownership
packages/
  schemas/                       # shared validated domain inputs / DTOs
  typing-core/                   # unchanged pure headless typing engine
  contracts/                     # retained external API contracts only, eventually
  ...
```

The route tree above is the intended hierarchy; confirm generated route IDs and
literal-dot filename escaping with the pinned Solid Router generator in Phase 1.1.
Map any additional standalone HTML URLs during Phase 0.1; preserve their URLs or
add explicit redirects. `__root` owns not-found handling and correct HTTP status.
Do not expose backend files through route discovery.

Expose narrow server-only subpaths from `@oxytype/backend`, such as runtime,
services, and jobs. Mark server implementations with Start import protection and
enforce dependency boundaries in lint/build checks. Shared browser types come
from `packages/schemas` or type-only exports, not a backend barrel import.

### Ownership rules

| Concern | Owner | Rule |
| --- | --- | --- |
| Route, params, search, redirect, loading/error UI | Start/Router | No mirrored `activePage` or selected-profile routing state. |
| Server data | Query | Shared query-option factories; stable keys include actor/client/filter dimensions where applicable. |
| History/live derived data | Browser DB collections | Construct lazily in app-owned providers; dispose/reset on account changes. |
| User/session authority | Better Auth on server | Client session is a UI observation; every private operation rechecks access. |
| Preferences/themes | Preferences provider + existing storage schemas | Preserve stored keys/migrations and ordering of local/server/URL settings. |
| Typing session | Browser provider + typing route | Session data can survive route remounts where required; DOM refs/listeners cannot. |
| Modal/popup/toast state | Root UI provider | Components own dialog refs, subscriptions, cleanup, focus restoration. |
| Database/business operations | Backend services/DAL | Services accept typed context/input, not Hono/Router/legacy HTTP request types. |
| Invocation bindings | Worker runtime | D1, secrets, auth/config instances stay scoped to an invocation. |

Keep one browser QueryClient per mounted application and one server QueryClient
and router per SSR request. Use the supported Solid SSR integration for the
pinned versions, or an explicitly tested dehydration/hydration adapter if needed;
do not copy React integration code into Solid. Hydrate only safe data required by
the route. Never serialize auth tokens, internal records, or the full result history.

Loaders coordinate loading and prefetch through Query; they do not create a
second long-lived business-data cache. Side effects and writes do not run during
preloading. Query invalidation after mutations updates the relevant collections
and summaries without maintaining an independent mutable account snapshot.

### Rendering and navigation contract

| Route | Initial rendering | Important behavior |
| --- | --- | --- |
| `/` | SSR document/shell; client-only typing leaf | No engine/browser imports execute during SSR. Input readiness does not wait for full account history. |
| `/about`, `/privacy-policy.html` | SSR; prerender only for truly static content | Dynamic statistics still load through normal data queries. |
| `/leaderboards` | SSR safe public first-page data | Validated search drives filters/pagination; private rank enhancements load separately. |
| `/profile` and `/profile/$uidOrName` | SSR search/public profile content | Respect profile visibility; personalized controls stay separate. Preserve existing client-data selection where exposed. |
| `/settings` | SSR stable shell; client preference UI | Account tabs require authenticated server operations; preserve tab/deep links. |
| `/login`, `/device`, `/account` | SSR session/redirect shell; client-only browser/chart parts | No private HTML caching; private calls enforce authorization independently of layout guards. |
| `/oauth-callback.html` | Minimal Start route + client popup completion | Preserve origin/source/request-ID verification and callback URL. |
| Unknown URL | Start not-found document | HTTP 404; no false-success SPA fallback. |

Keep the root and common layout SSR-capable. A parent with SSR disabled also
restricts descendants; placing `ssr: false` on the entire root would defeat public
page rendering. Use client-only leaves and dynamic browser imports, not just
guards around JSX after browser-dependent modules have already executed.

Initially return application HTML and personalized responses with conservative
cache headers (`no-store` for private/session responses). Cache versioned static
assets immutably; defer shared HTML caching until session independence is proven.
Emit route-specific titles, canonical URLs, descriptions, and Open Graph metadata.

Use Router's links, intent preloading, navigation, and blockers. Search-only
updates preserve page state and replace history where current behavior requires
it. Browser back/forward, keyboard activation, modified clicks, external URLs,
downloads, trailing slashes, hashes, and auth redirects retain expected behavior.
Animations are presentation around route changes, not a second page lifecycle.

Do not assume cached pages mean resumable active tests: the current test page
restarts/clears state on hide/show. Characterize that behavior first. Preserve it
with explicit session commands and route cleanup; never keep stale DOM refs alive
as an accidental substitute for state ownership. Retain `no_quit` blocking,
including existing restrictions on forced navigation.

### Server transport and policy contract

First-party path: component/loader → server function → validated input + policy
→ backend service → DAL/transaction → safe DTO → Query/collection update.
SSR invokes the same service path without a loopback HTTP request. Retained HTTP
endpoints use the same services and policy primitives through server routes.

Before switching each operation, account for everything its old middleware did:
body limits/parsing, authentication, fresh-session requirements, permission and
configuration gates, rate limits with stable operation identities, trusted IP,
CSRF/origin checks, client/version handling, error/status mapping, response
validation where required, and audit logging. Endpoint transport changes must
not silently drop those behaviors. Include explicit CSRF middleware when supplying
a custom `start.ts`; preserve Better Auth's own body/cookie handling.

Keep server functions thin. Put business rules in services so jobs and retained
HTTP endpoints share the same implementation. Treat query/loading helpers as
potential server and client code; server-only work crosses a declared boundary.

## Execution rules

- Complete stages in order. Work within a stage can be split into small changes,
  but do not advance past its exit checks with unresolved failures.
- Develop the migration in an isolated branch/build. Production remains on the
  existing app until the replacement passes cutover gates. Temporary source
  coexistence does not imply two live routers or dual result writes.
- Each phase records moved files, removed legacy responsibility, validation,
  and remaining adapters in a migration ledger created in Stage 0.
- Run focused existing tests while changing a feature; add meaningful coverage
  only for new boundaries/behaviors. Broader suites run at stage/release gates.
- No calendar estimate before the foundation and SSR/runtime checks are complete.
  Re-estimate after Stage 1; do not make migration completion depend on TUI work.

## Stage 0 — Inventory, baseline, and migration contract

### 0.1 Map behavior and consumers

Status: complete. [Behavior/consumer inventory](tanstack-start/behavior.md) and
[operation ledger](tanstack-start/operations.json).

- Inventory routes, standalone HTML entries, deep links, redirects, URL encodings,
  auth flows, downloads, admin/config endpoints, and integration callbacks.
- Create an operation ledger from `frontend/src/ts/ape`, backend route metadata,
  contracts, and actual browser callers. Classify each as a web server function,
  retained external server route, auth route, job operation, or retired endpoint.
- Identify external consumers from documented contracts and deployment knowledge;
  record uncertain usage rather than assuming all `/api` routes are web-only.
- Record test-page hide/show behavior, settings precedence, startup sequencing,
  account-switch resets, and existing offline result-save behavior.

Deliverable: behavior/operation ledger with route, owner, current policy, target,
callers, validation, and retirement condition.

### 0.2 Capture meaningful baselines

Status: complete. [Measurements, frozen budgets and validation](tanstack-start/baseline.md).

- Run current web, backend/D1, shared-package, and browser checks; record existing
  failures separately from migration regressions.
- Record production-build eager JS, cold/warm input readiness, public page load,
  typing/rendering benchmark, result-save latency, Worker size/startup/CPU, and
  representative D1 query counts using the same fixtures/environment.
- Use existing `measure-eager-js` and word-rendering benchmark facilities. Capture
  repeated samples, not a single timing; set numeric regression budgets from
  observed variance before implementation. No unexplained regression crosses a gate.

### 0.3 Freeze the architecture contract

Status: complete. [Compatibility contract](tanstack-start/contract.md) and
[release/rollback rules](tanstack-start/release.md).

- Confirm this document's defaults: Solid 1.x, Vite+, Cloudflare, one origin/Worker,
  backend service package, selective SSR, existing storage and OAuth URLs.
- Record dependency/version compatibility checks needed in Stage 1, including
  Solid Router/Query SSR support and Cloudflare's Vite environment integration.
- Record the rollback artifact/config and release coordination rules, including
  old service workers and already-open browser tabs.

**Exit:** inventory and baseline exist; every current web capability has a target;
no unresolved product-scope decision blocks foundation work.

## Stage 1 — Establish Start and prove the production runtime

### 1.1 Add the real Start foundation

Status: complete. [Stage 1 ledger](tanstack-start/stage-1.md).

- Pin compatible Start/Solid Router/build packages; adapt `frontend/vite.config.ts`
  for Start, Solid, Tailwind, static directory, workspace aliases, and generated routes.
- Provide one local Start/Cloudflare development entry with same-origin functions,
  auth, and D1. Retain an explicit frontend-only/offline development mode; do not
  require a separately running legacy API for the replacement application.
- Create router/start/server/Worker entries, root document, layout, and boundaries.
  Make `/about` a native Start route with real SSR, not a mounted legacy app.
- Keep old entry/build available only as the production rollback path while the
  isolated migration build develops. Do not send unknown Start routes into it.
- Prove Vite+ compatibility, generated route types, server-only exports, test
  transforms, and the exact Solid Query hydration mechanism.

### 1.2 Prove one Worker handles all invocation types

Status: complete. [Stage 1 ledger](tanstack-start/stage-1.md).

- Bind Start fetch to `withRuntime`; wire queue/scheduled exports to existing jobs.
  Reuse the local D1 persistence location or migrate its dev configuration explicitly.
- Exercise one real read service through a server function, including during SSR;
  prove no call to the legacy HTTP API occurs.
- Test concurrent requests against distinct actors/bindings, background work,
  queue delivery, and a scheduled invocation in workerd.
- Verify binding availability and async context through streamed responses and
  callbacks; keep references explicit where runtime lifetime requires it.

### 1.3 Port document, assets, and response policy

Status: complete. [Stage 1 ledger](tanstack-start/stage-1.md).

- Bring over fonts, semantic theme CSS, metadata, icons, manifest, public assets,
  and route-independent shell. Keep SSR markup stable before browser preferences load.
- Preserve `frontend/src/html/warnings.html` as the static source for `noscript`
  and `#nocss`; emit it into initial HTML without a client mount dependency.
- Integrate CSP/nonces for Start scripts/styles and any theme initialization.
  Account for the fallback's existing inline script/handlers explicitly; preserve
  its recovery behavior without broadly weakening script policy.
- Establish HTML/asset headers, 404/status behavior, error reporting, and environment
  allowlisting. Secrets come from runtime bindings, not public build-time config.

### 1.4 Establish migration CI and staging build

Status: complete. [Stage 1 ledger](tanstack-start/stage-1.md).

- Add Start build + Worker dry-run and SSR/workerd checks to CI while retaining
  existing checks for code not yet migrated. Use a migration-only staging target.
- Verify direct loads, refreshes, streaming/hydration, static assets, root errors,
  OAuth route reachability, and fallback HTML with JavaScript/CSS disabled.

**Exit:** a native SSR route and real server function work in the production-like
Cloudflare runtime; fetch/queue/Cron coexist; no browser code or secret leaks into
the wrong bundle. Resolve foundation incompatibilities before mass file movement.

## Stage 2 — Replace global bootstrap with explicit state owners

### 2.1 Define factories and import boundaries

Status: complete. [Stage 2 ledger](tanstack-start/stage-2.md).

- Replace module-level QueryClient/router/user snapshot initialization with factories.
  Convert SSR-reachable mutable stores to request/app-owned state.
- Keep SSR owners limited to safe state; instantiate browser integrations only
  after mount. Move browser anti-tamper/global setup deliberately, including the
  current Math locking, so it never mutates shared Worker globals during SSR.
- Inventory browser side effects reachable from `index.ts`, `auth-client.ts`,
  collections, hooks/effects, test modules, and virtual configuration imports.
- Enforce that `.server` modules cannot reach client bundles and browser entry
  modules do not execute through server imports. Remove cross-layer barrels/cycles.

### 2.2 Build providers and browser runtime

Status: complete. [Stage 2 ledger](tanstack-start/stage-2.md).

- Introduce preferences, auth observation, collections, overlays, and typing-session
  owners with typed accessors. Keep domain signals where useful, but give their
  lifetime and teardown a concrete owner.
- Move listeners, timers, cookie-consent activation, speech/audio, version checks,
  Sentry browser setup, and debug helpers into component-owned lifecycle/ref work.
- Replace auth/config global startup promises with explicit readiness states.
  Public pages do not wait for history downloads or unrelated auth synchronization.

### 2.3 Preserve preferences and data identity

Status: complete. [Stage 2 ledger](tanstack-start/stage-2.md).

- Keep existing localStorage/IndexedDB schemas, migrations, language hashes,
  config metadata, and local/server/URL precedence.
- Define actor-scoped cache keys and collection lifetimes; cancel in-flight work
  and clear private data on logout/account change. Late responses must not restore
  the previous user's state. Preserve existing web/history client partitions.
- Keep theme/font setup fast and hydration-safe; choose a minimal approved early
  theme bootstrap if needed rather than blocking the whole app.

**Exit:** importing server routes cannot initialize browser stores; independent SSR
requests cannot share user data; remount/HMR does not duplicate listeners; guest
typing startup remains independent of full account/history loading.

## Stage 3 — Extract server services and integrate authentication

Status: complete, with recorded Worker-byte deviation. [Validation and handoff](tanstack-start/stage-3.md).

### 3.1 Extract policies and operation services

Status: complete.

- Separate reusable rules from Hono middleware in `backend/src/middlewares` and
  controllers. Introduce typed service context, DTOs, errors, and operation IDs.
- Move business operations out of `MonkeyRequest`/`HttpRequest` controller signatures.
  Keep existing DAL, atomic mutation, ranking, anticheat, and job behavior intact.
- Point temporary Hono adapters and new Start adapters at the same services;
  never maintain two business implementations. Port one public read and one
  authenticated read before expanding the conversion.

### 3.2 Add Start policy adapters

Status: complete.

- Implement request logging/context/security headers and function-level auth,
  permission/config gates, input validation, rate limits, and error mapping.
- Preserve body/telemetry limits, trusted proxy/IP policy, fresh-session checks,
  audit events, and retained API response headers. Define stable rate-limit keys
  rather than copying instance-order-dependent middleware identities.
- Explicitly install same-origin/CSRF protection for server functions and test
  direct calls without a page visit. Layout guards alone never authorize data.

### 3.3 Move Better Auth and session flows

Status: complete.

- Delegate `/api/auth/*` to Better Auth through a Start server route, with untouched
  request bodies, all `Set-Cookie` headers, trusted origins/IP handling, and existing
  cookie prefix/secret/session tables. Avoid an unnecessary mass sign-out.
- Implement server session reads and private-route guards. Forward fresh-session
  semantics to sensitive operations; expose only safe UI session information.
- Move login, signup completion/cancellation, provider linking/unlinking,
  reauthentication, logout, session expiry, and popup callback into Start-owned flows.
- Preserve `/oauth-callback.html`, popup validation, and externally configured OAuth
  callback URLs. Keep `/device`'s existing web behavior; no new TUI auth work.

**Exit:** real workerd tests prove guest/private/expired/fresh/admin access and
origin/rate/config failures. Login/logout and session changes update route and
cache state without a global forced page reload pipeline.

## Stage 4 — Migrate routes and remove parallel page lifecycles

Status: complete; intermediate Worker footprint recorded. [Stage 4 validation and handoff](tanstack-start/stage-4.md).

### 4.1 Migrate public pages

Status: complete.

- Move about, profile search/profile, leaderboards, privacy/standalone pages, and
  not-found handling into the route tree. Components live in features/shared UI.
- Use validated params/search and route-owned metadata, pending/error/not-found
  components. Profile reads and leaderboard reads use server functions/services.
- Prefetch through Router + Query with explicit freshness/cancellation behavior;
  remove migrated custom link/data prefetch responsibilities.

### 4.2 Migrate settings and authenticated pages

Status: complete.

- Move account and settings to native routes/layouts. Keep shared charts lazy and
  browser-only where required; avoid serializing all results for SSR.
- Move tab/filter URL state into validated route search. Preserve settings highlight
  links, pagination, existing client-data selection, auth redirects, and
  `/account-settings` redirect/query/hash behavior.
- Replace global profile selection/active-page gates with route data and scoped
  feature state. Retain useful UI state through explicit owners/search/storage.

### 4.3 Replace navigation callers and transitions

Status: complete.

- Convert `Link`, router-marked buttons, command palette actions, modals, auth
  callbacks, and imperative callers to Router navigation.
- Implement active-test/result-save blockers through Router; separate completion
  of navigation from optional visual animation. Check rapid repeated navigation.
- Preserve replace-only search updates, history, scroll/focus, accessibility,
  modified clicks, and download/external behavior.
- Remove migrated dependencies on `Page`, `PageWithUrlParams`,
  `NavigationRuntime`, `AppPages`, and `page-controller`. Remaining references
  should be restricted to the typing integration completed in Stage 5.

**Exit:** every non-typing page is native Start on direct load and client navigation;
page loading/metadata/URL state no longer depends on legacy page classes.

## Stage 5 — Make typing a native route with an owned browser runtime

### 5.1 Introduce typing session and lifecycle boundaries

Status: complete. [Stage 5 ledger](tanstack-start/stage-5.md).

- Move browser orchestration around `packages/typing-core` into the typing feature;
  preserve engine algorithms, deterministic fixtures, and event/telemetry formats.
- Replace `pages/test.ts` hide/show hooks with explicit route entry/exit/session
  commands matching the Stage 0 behavior contract. Clean up funboxes, focus,
  timers, and incomplete-test state in one owned lifecycle.
- Keep serializable session data separately from route-local word/input/caret refs.
  On remount, rebuild refs safely; prevent duplicate timers and dangling callbacks.

### 5.2 Move browser integrations and URL settings

Status: complete.

- Integrate words/letters/caret, keymaps, IME/composition, hotkeys, focus, scroll,
  sound/TTS, charts, screenshots, funboxes, and challenges under owned refs/lifecycles.
- Move shared test-settings/theme/challenge URLs from auth-event subscriptions
  into route-aware parsing plus one-time client application after settings readiness.
  Do not restart tests on unrelated auth refreshes or speculative route preload.
- Preserve URL decoding/backward compatibility and existing browser-handoff behavior
  if exposed by the web app; no new TUI-side implementation is included.

### 5.3 Verify responsiveness and route behavior

Status: complete. [Validation and handoff](tanstack-start/stage-5.md).

- Run existing typing, quote, time, restart, command palette, modal, accessibility,
  screenshot, funbox, and typing-core parity checks against Start.
- Add targeted coverage for navigate-away/back, `no_quit`, completion/save in
  progress, route disposal, auth changes during typing, and deep-linked startup.
- Compare repeated input-readiness and word-rendering benchmark samples with
  Stage 0 budgets. Do not put network/Router/Query work on each keystroke.

**Exit:** typing is a native client-only Start leaf; no legacy page lifecycle or
cached-page mounting system is needed; product behavior and performance meet baseline.

## Stage 6 — Finish server-function data access and retire web API glue

### 6.1 Migrate read models and collections

- Replace remaining Ape reads with feature query options calling server functions.
  Include configuration/PSAs, account summaries/history/activity, tags/presets,
  themes/favorites, inbox, and supported admin/quote capabilities from the ledger.
- Replace mutable global `dbSnapshot` as a server-data source with canonical queries
  and browser collections plus narrowly defined derived selectors.
- Preserve local personal-best/result acknowledgement behavior through explicit
  cache updates; avoid duplicate owners for the same user/server data.

### 6.2 Migrate ordinary mutations

- Move config sync, presets/tags/themes, profile/preferences, favorites/ratings,
  account actions, inbox/reward claims, and remaining web operations to functions.
- Preserve optimistic updates, rollback/error UX, account reauthentication, rate
  limits, permission/config gates, and query/collection invalidation.
- Migrate admin/dev/integration-facing operations according to the ledger; endpoints
  that are external protocols stay server routes with their documented contract.

### 6.3 Migrate result submission last

- Make submission a server function invoking the existing extracted submission
  service. Preserve completed-event schema, body limits, hash/replay/anticheat
  validation, server-derived identity/client policy, bans/config checks, and rate limits.
- Preserve atomic result/progression/PB/XP/streak/leaderboard writes, duplicate
  detection, outbox/jobs, and save-acknowledgement DTO semantics.
- Verify real D1 writes, duplicate/retry/timeout cases, telemetry failures, concurrent
  submissions, and cross-user attempts. Never dual-write through old and new transports.
- Update browser result-save fixtures to exercise Start's protocol. Keep fast UI
  tests, but add a real Worker/D1 integration path instead of relying entirely on
  the current mocked `/api/results` acknowledgement.

### 6.4 Retire transport machinery

- Complete the operation ledger: every browser caller uses functions or a justified
  HTTP protocol route. Remove web Ape/ts-rest adapters, lazy contract clients,
  obsolete compatibility banners, and web-only HTTP endpoints after their callers retire.
- Keep stable HTTP response contracts for the external endpoints selected in Stage 0;
  use Start routes over shared services. Regenerate only the retained API docs.
- Remove Hono/legacy adapters when no retained handler needs them. A temporary
  compatibility adapter must have a named retirement condition before cutover.
- Keep any old-tab compatibility window explicit: retain only necessary legacy
  transports for that window, with no duplicate business implementation.

**Exit:** all current web capabilities use the target transport/service design;
result persistence and rewards are unchanged; no web functionality requires Hono.

## Stage 7 — Complete offline support, deployment, and observability

### 7.1 Rebuild the PWA/offline contract

- Adapt manifest/service-worker generation to Start output paths and code splitting.
  Version caches by build; never assume the old `/js` filename/hash pattern.
- Serve a deliberately generated, user-independent offline shell and cache the
  chunks/assets needed for guest typing after one online visit. Define offline
  fallback for document requests; never cache private SSR HTML/session payloads.
- Exclude auth, server-function/RPC paths, mutations, private reads, and non-GET
  responses from generic runtime caching. Do not reuse the existing broad
  non-`/api` NetworkFirst rule: Start function paths may live outside `/api`.
- Preserve existing offline save/error behavior; do not add automatic result
  replay/upload as an incidental migration feature.
- Handle stale HTML/chunk mismatches, old service workers, update prompts, and
  waiting-worker activation. Do not reload/activate an update during active typing
  or a pending save. Keep fallback cache recovery usable.

### 7.2 Transfer delivery ownership to Start

- Move/retarget Wrangler staging/production configs to the application package.
  Preserve Worker names, origins, bindings, secrets, D1 IDs/migration directories,
  queue consumers, Cron, compatibility flags, and environment isolation.
- Replace `prepare-site.ts`, old static SPA dispatch, and assumptions about
  `frontend/dist/index.html`/`oauth-callback.html` with Start's generated outputs.
  Copy only required docs/quote/config assets; private backend assets stay private.
- Adapt production input validation/build scripts and root scripts. Keep a single
  production build artifact containing matching server/client assets and version.
- Update CI path filters so server-package changes rebuild/test the web Worker.
  Update release helpers/tests, deploy dry-run, D1 migration commands, and release
  publication ordering. No framework change requires destructive schema migration.

### 7.3 Exercise production behavior in staging

- Run the built Worker in workerd and staging, not only Vite dev. Verify OAuth
  cookies, direct URLs, real result saves, queues/Cron, assets, offline revisit,
  retained endpoints, CSP, logging, and safe error responses.
- Connect browser/server errors to the same release ID. Measure SSR latency/CPU,
  bundle/Worker size, query count, input readiness, and save latency against budgets.
- Test a previous-build tab and service worker against a new build and a rollback;
  define a controlled refresh/retry path for stale server-function identifiers.
  Version-sensitive result failures must remain visible and avoid double submissions.

**Exit:** one deployable Start artifact passes web + backend integration and offline
checks with the intended production configuration, including update/rollback cases.

## Stage 8 — Remove the old architecture and cut over

### 8.1 Delete superseded code and document the new system

- Delete the old Solid Router setup, `NavigationRuntime`, `navigation/routes.ts`,
  page controller/classes/loading lifecycle, `AppPages`, custom link-prefetch,
  active-page routing state, bootstrap entry, and obsolete HTML-injection paths.
- Delete completed migration bridges, unused dependencies, global auth/config
  startup promises, redundant state mirrors, and obsolete transport tests.
  Keep/rewrite tests around user behavior and surviving policy boundaries.
- Update architecture, contributor setup, Cloudflare operations, production/staging
  setup, root-script docs, and `AGENTS.md` where needed. Update Storybook providers.
- Run unused-code/dependency analysis and inspect client/server import graphs;
  a clean build alone is not proof the legacy architecture has been removed.

### 8.2 Run the complete migration acceptance gate

- Run web unit/component tests, backend service/real-D1 suites, shared-package tests,
  browser regressions, production build/Worker dry-run, asset checks, lint/typechecks,
  and formatting. TUI validation is not a completion gate for this work.
- Verify cross-request/account isolation, direct server-function authorization,
  malformed inputs, retained policies, private-cache exclusion, hydration/CSP,
  route statuses, deep links, and fallback HTML.
- Compare final baseline measurements. Investigate budget failures; do not silently
  widen thresholds to pass. Record any intentional behavior changes explicitly.

### 8.3 Release, observe, and retire temporary compatibility

- Build from the validated commit, deploy to staging, then release through the
  updated production workflow. Avoid running the old scheduled auto-release path
  against a partially migrated main branch; coordinate its transition first.
- Retain the previous deployable artifact and compatible database/storage formats.
  If rollback is required, roll back server and client assets together and account
  for service-worker caches. Do not require restoring the database for a code-only rollback.
- Observe agreed launch signals: startup/input readiness, auth/session failures,
  save success and duplicates, Worker errors/CPU, queue/DLQ health, and route errors.
- Remove old-tab transport compatibility after its documented window, close the
  ledger, and keep no unowned temporary wrappers in production.

**Exit:** production runs the Start architecture, legacy machinery is removed,
operational docs and release automation match it, and launch signals remain within
the recorded acceptance budgets.

## Validation commands and evidence

These commands describe implementation gates. Stage 0 ran the existing application
suites and captured evidence in the [baseline](tanstack-start/baseline.md).
Keep scripts working as package responsibilities move.

```sh
# Focused examples, run in the owning workspace.
vp -C frontend test run __tests__/navigation/guard.spec.ts
vp -C frontend test run __tests__/test/typing-core-parity.spec.ts
vp -C backend test run __tests__/d1/http.spec.ts

# Stage/release gates; retain equivalent commands after moving scripts.
vp run lint-fe
vp run lint-be
vp run lint-pkg
vp run test-fe
vp run test-be
vp run test-pkg
vp run build
vp run test-e2e
vp run --filter @oxytype/frontend measure-eager-js
vp run --filter @oxytype/frontend benchmark-word-rendering
vp run lint-styles
vp run check-assets
vp run knip
vp fmt frontend/src backend/src --check
```

Add SSR-isolation, server-function-policy, production-Worker, offline/update, and
real result-save suites where existing tests do not exercise those boundaries.
The existing Playwright config starts Vite dev and result-save tests mock REST;
neither alone proves the production Start Worker or persistence integration.
Markdown is excluded by the repository formatter; review this plan's structure
and whitespace directly instead of treating a skipped formatter run as validation.

## Completion checklist

- [ ] Start owns the document, all web routes/layouts, navigation, data loading,
  server functions/routes, and production HTTP dispatch.
- [ ] Old page/controller/router/bootstrap systems and temporary app wrappers are gone.
- [ ] Every web capability and retained external operation is accounted for.
- [ ] Browser stores, private caches, and SSR runtime state have explicit lifetimes.
- [ ] Better Auth continuity and existing middleware policies survive transport changes.
- [ ] Typing behavior/performance, anticheat, and atomic result progression are preserved.
- [ ] Static `noscript`/`#nocss` fallbacks work without client rendering.
- [ ] Offline/update behavior, Cloudflare jobs, CI, releases, and rollback are verified.
- [ ] Source boundaries/docs reflect the target architecture; no TUI work is required.

## Unresolved questions

No blocking product-scope questions. Stage 0 recorded measured budgets, published
and uncertain external contracts (conservatively retained), and the old-client
compatibility window. Stage 1 proved pinned Solid Query SSR support and
Vite+/Cloudflare integration ([evidence](tanstack-start/stage-1.md)). Record
later findings in the ledger; ask only if evidence requires a product decision
outside these defaults.

## Official references

Verified against current official documentation on 2026-10-15. Use the versions
pinned during Stage 1 when selecting exact APIs; examples may change afterward.

- [TanStack Start 1.0 release](https://tanstack.com/blog/tanstack-start-1-0)
- [Start framework and Solid support](https://tanstack.com/start/latest)
- [Server entry point](https://tanstack.com/start/latest/docs/framework/solid/guide/server-entry-point)
- [Execution model](https://tanstack.com/start/latest/docs/framework/solid/guide/execution-model)
- [Selective SSR and inheritance](https://tanstack.com/start/latest/docs/framework/solid/guide/selective-ssr)
- [Server functions and same-origin protection](https://tanstack.com/start/latest/docs/framework/solid/guide/server-functions)
- [Middleware](https://tanstack.com/start/latest/docs/framework/solid/guide/middleware)
- [Import protection](https://tanstack.com/start/latest/docs/framework/solid/guide/import-protection)
- [Cloudflare hosting](https://tanstack.com/start/latest/docs/framework/solid/guide/hosting)
- [Environment variables](https://tanstack.com/start/latest/docs/framework/solid/guide/environment-variables)
- [CSS and CSP nonces](https://tanstack.com/start/latest/docs/framework/solid/guide/css-styling)
- [Router preloading](https://tanstack.com/router/latest/docs/guide/preloading)

Architecture choices and migration ordering are Oxytype-specific recommendations,
not guarantees supplied by those documents.
