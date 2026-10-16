# Stage 4: native routes and navigation

Base: Stage 3 `54fc00fe9`, PR #138; ancestor and green remote CI verified.
Inherited implementation through `5aaf6e7d9` reviewed; clean worktree at takeover.
No unrelated changes. Production still uses the explicit rollback build.

Phases implemented in order: 4.1 public routes → 4.2 private/settings routes →
4.3 navigation. **Exit validation in progress; Stage 4 not yet complete.**

## 4.1 Public routes

- Native about, profile lookup/profile, leaderboards, privacy policy and not-found
  routes render useful public content with route-owned metadata and HTTP status.
  `features/*` owns route presentation; shared controls retain one implementation.
- About statistics/histogram and public profiles/boards call thin Start functions
  over extracted backend services and existing policies; no internal HTTP request.
  Private rank queries authorize independently and stay out of SSR hydration.
- Params/search select profiles, boards and pages. Flat legacy URL encoding,
  invalid-search fallback, client partitions, stored board selection, pagination,
  previous boards and go-to-user behavior retained. Profile misses return 404;
  service/config failures degrade inline without changing the document status.
- Router intent preload invokes Query options; Query owns freshness and abort
  signals. Unobserved speculative public data may finish into its bounded cache;
  subsequent observers reuse it. There is no duplicate route data store. Native
  links no longer invoke legacy LinkPrefetch or its page/data prefetch hooks.
- Former entry URLs redirect explicitly; published literal-dot standalone URLs,
  query/hash handling and static warnings source retained.

## 4.2 Account and settings

- Pathless authenticated layout uses the canonical server-verified session query;
  guests/unregistered users go to login with a safe return path. Sensitive services
  still enforce their own auth. Offline private routes preserve the home redirect.
- Native account mounts host-neutral account content; result collections/charts
  remain browser-only. Its client selector is replace-only route search. Filters
  keep existing localStorage ownership; table sorting/limits stay component-local.
- App-owned account runtime loads data once per registered actor after the session
  owner switches scope. Actor switches cancel stale work and reset collections.
  This reuses Stage 2 leases; snapshot/Ape retirement remains Stage 6.
- Settings has a stable SSR shell and browser preference leaf. Validated search
  owns tabs; legacy account tab names, guest fallback, highlight deep links and
  replace-only updates retained. Highlighting an already selected tab preserves
  the deep link; search changes highlight without remounting the page.
- `/account-settings` guards first and replaces with `/settings?tab=account`, with
  original query keys overriding the default and hash preserved.

## 4.3 Navigation and common layout

- Native common layout owns SSR header/content geometry, client chrome, overlays,
  modal/popup roots and scroller refs. Shared links/router-marked buttons use
  Router under LinkHost. Command palette, modals and imperative callers bind to
  the mounted Router; no parallel page lifecycle runs in Start.
- Router blockers preserve restart/calculation checks and active `no_quit`, even
  for forced imperative navigation. Navigation promises resolve through Router;
  rapid navigation settles at the latest target independently of old loaders or
  optional presentation animation. Inactive pages never unconditionally confirm
  document exits. Full typing/unload lifecycle belongs to Stage 5.
- Content receives focus on pathname changes; search-only updates preserve focus
  and scroll. Router owns window/container scroll cache. Lazy settings announce
  readiness and reapply that same cache once content has height. Shared chrome
  derives typing-route behavior directly from its host, without an active-page
  mirror. Palette focus observation tolerates an unmounted typing page.
- Modified clicks, external targets and downloads remain native. Header Storybook
  supplies explicit layout props; committed diagnostic capture script removed.

## Remaining adapters and retirement

| Adapter | Retirement |
| --- | --- |
| Legacy page/controller/NavigationRuntime/AppPages and non-typing wrappers | Rollback entry only; no native page imports them. Preserve rollback until Stage 8; typing lifecycle is Stage 5 |
| Typing-specific active-page checks, page transitions, challenge/URL/session hooks | Stage 5; native index remains the foundation placeholder. No typing integration started here |
| Settings section signal/effects and global selected profile | Rollback-only routing state; native features use route props/search. Delete with rollback in Stage 8 |
| Account snapshot, Ape config/history/mutations, command palette profile validation, leaderboard rank-memory mutation | Stage 6 functions/query migration; native page loading/URL ownership is already independent of page classes |
| `/api/$` in-process Hono adapter | Stage 6 explicitly ports retained HTTP protocols and remaining browser operations; required now for shared controls. Start owns dispatch; services remain shared, with no loopback or duplicate business rules |
| Production deployment/PWA/static legacy delivery | Stages 7–8; no deployment or service-worker cutover here |

## Decisions and API verification

- Native rich controls share host-neutral components under `src/ts/components`;
  rollback wrappers remain available. Reusing presentation does not mount legacy
  pages or preserve their controllers in the native graph. Bundle boundary tests
  reject legacy lifecycle markers in both client and server output.
- Existing HTTP adapter added for non-migrated shared reads/mutations, with the
  retirement condition above. This keeps Stage 4 usable without prematurely
  performing Stage 6 transport migration.
- Pinned Router memory history skips POP/unload blockers; guard tests use actual
  browser history for those cases. No custom history/blocker system introduced.
- Installed Solid Router 1.170.41/core 1.171.37, Start 1.169.2 and Solid Query
  5.104.0 source/types checked for `useBlocker`, `onResolved`, `scrollRestoration`,
  `useElementScrollRestoration`, `defaultPreloadStaleTime` and query abort signals.
  Official references: [navigation blocking](https://tanstack.com/router/latest/docs/guide/navigation-blocking),
  [scroll restoration](https://tanstack.com/router/latest/docs/guide/scroll-restoration),
  [data loading](https://tanstack.com/router/latest/docs/guide/data-loading),
  [Solid Query prefetching](https://tanstack.com/query/latest/docs/framework/solid/guides/prefetching).
- Linux CI exposed external built-in CommonJS requires (`crypto`, `util`, `fs`)
  in dependencies reached by the HTTP adapter. The local Cloudflare build had
  converted them automatically. SSR now explicitly installs Vite+/Rolldown's
  [ESM external-require plugin](https://rolldown.rs/builtin-plugins/esm-external-require)
  for Node built-ins. Both production/test Worker bundles reject runtime require
  calls; no global require shim or dependency source edits.

## Exit validation

Pending final sequential runs. Initial overlapping builds/tests caused fixture
asset replacement and resource-contention timeouts; those runs are not exit
proof. Real regressions found by browser checks (same-tab highlight rewriting,
late content scroll restoration, palette requiring mounted typing refs) fixed.
Frozen budgets unchanged. Typing/runtime benchmarks belong to Stage 5; this
stage changes no typing engine, result transport, D1 data or authentication policy.

## Next stage prerequisites

Stage 5 replaces the native index placeholder with the owned client-only typing
leaf. Transfer typing-specific active-page guards, hide/show/reset commands,
refs/listeners, URL settings/challenges and beforeunload behavior; preserve no_quit
and completed/save behavior. Do not reintroduce the rollback app/page cache into
Start. Keep SSR public routes, private guards and `ci-start` green. Stage 6 owns
remaining data/HTTP adapters. No TUI work required.
