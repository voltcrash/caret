# Phase 0.3: architecture and compatibility contract

The [target architecture](../TANSTACK_START_MIGRATION.md#target-architecture) is
accepted unchanged. Stage 0 makes its evidence/decisions explicit; it introduces
no replacement application and selects no untested Start versions.

- Keep Solid 1.x, Vite+, Tailwind semantic colors, `class`/`cn`/`Fa`, Query/DB/Form/
  Table, Better Auth, Drizzle/D1 and pure typing-core. Bun remains TUI-only.
- `frontend/` becomes the Start app/deployment owner. `backend/` becomes a
  server-only service/DAL/policy/jobs package, with narrow protected subpaths.
  Browser DTOs/input schemas come from shared packages, never a backend barrel.
- One production origin/Worker. Fetch → one invocation runtime → Start request
  middleware/SSR/routes/functions → typed policy/services. Queue and scheduled
  handlers retain one runtime per invocation. No loopback Hono requests or
  manufactured legacy HTTP objects in services; no mutable global service context.
- Root/layout render on the server. Public useful content uses SSR; typing,
  storage, charts/audio/input/DOM integrations mount as client leaves with owned
  lifecycles and disposal. A permanently mounted legacy app is not a migration.
- One router/QueryClient per SSR request, one browser QueryClient per mounted
  app; actor-scoped keys and collection disposal on account switches. Loaders
  coordinate Query. Preferences, session data and overlay state have explicit
  providers; route params/search replace selected-page/profile mirrors.
- Web operations become thin functions over policy/services. Published public/
  ApeKey protocols and uncertain operational HTTP consumers retain Start server
  routes over the same services. [Inventory](operations.json): 47 web-function
  targets, 35 retained HTTP targets (19 published contracts). Some retained
  routes also have web callers, which move to functions. No dual result writes.
- Preserve origin `https://oxytype.voltcrash.com`, `/api/auth`, `oxytype` cookie
  prefix, production secret/session tables, linked-provider policy, disabled email/
  password flows, fresh-session 60s checks, GitHub callback
  `/api/auth/callback/github`, optional Google callback and `/oauth-callback.html`.
  Preserve body/cookie/CSRF/trusted-IP handling, audit, limits and permissions.
- Preserve D1 IDs/history/migrations, user/result/client partitions, hashes,
  anticheat, result deduplication/atomic progression, queue identities and Cron.
  Preserve all browser storage keys/schema migrations and settings precedence.
  No framework-driven destructive schema change or automatic offline upload.
- HTML/private/session responses start conservative (`no-store`); public versioned
  assets immutable; no generic cache for function paths. Root emits static
  `html/warnings.html` fallbacks. Preserve CSP behavior deliberately.

## Installed facts and Stage 1 proof obligations

Verified from installed manifests/types/source and official docs on 2026-10-15.
Not-installed optional peer mentions in the lockfile are not installed packages.

| Area | Installed fact | Required Stage 1 check |
| --- | --- | --- |
| Solid/compiler | solid-js 1.9.15, vite-plugin-solid 2.11.14; compiler peers include Solid ^1.7.2 and Vite 8 | Pin compatible Start/Solid Router/compiler/generator versions; dev, production and Vitest transforms/hydration |
| Existing router | @solidjs/router 1.0.0; no @tanstack/solid-router installed | Replace route ownership natively; generate IDs, pathless hierarchy, `$uidOrName`, index and `[.]` filename escaping; direct-load/refresh/404 and search codecs |
| Start | @tanstack/solid-start not installed | Pin it with its matching Router/generator/build peers; inspect exact installed exports; prove native `/about` SSR + real server function in built workerd before page moves |
| Query SSR | @tanstack/solid-query 5.104.0 peers Solid ^1.6.0; installed `useBaseQuery.ts` uses Solid resources, serializable observer hydrationData and query-core hydrate | Prove Solid-specific loader prefetch + resource hydration/streaming without duplicate request, private serialization or cross-request cache; if pinned Router integration exists use/test it, otherwise explicitly test adapter; do not paste React HydrationBoundary/provider code |
| Build | vite-plus 1.0.0; lockfile aliases vite to @voidzero-dev/vite-plus-core 1.0.0; runtime reports Vite 8.3.1 | Pin Cloudflare Vite plugin against actual Vite+ API; test environment graph, plugin order, import protection, static directory, server/client outputs, route typegen and test transforms; peer ranges alone are not proof |
| Cloudflare | Wrangler 4.146.0, Miniflare 5.20261001.0-alpha, workers-types 5.20261001.1; configs date 2026-10-02 | Preserve bindings/date/flags; Start SSR environment and custom Worker fetch/queue/scheduled exports together; D1/auth, waitUntil, AsyncLocalStorage across concurrent/streamed requests; reuse local D1 persistence explicitly |
| Runtime/imports | Existing built Worker runs in workerd in Stage 0; Miniflare 5 uses worker `config.manifest` and typed `config.env` bindings | Use installed v5 types, not v2/v4 examples; no browser engine/global Math locking at SSR import; inspect generated graphs for backend secrets/services in client |
| CSS/document | Tailwind 4.3.3, existing SSR build plugin + static fallbacks | Fonts/theme defaults/head metadata stable in initial HTML; CSS/JS-disabled fallbacks and CSP/nonces, popup URL, public/private cache headers |
| State/storage | Current QueryClient and browser collections are module-owned | Request/app factories and browser initialization owners in Stage 2; actor-switch tests; no full history in hydration payload |

Official references establish intended APIs, not compatibility of packages not yet
installed. [Start's Solid Cloudflare guide](https://tanstack.com/start/latest/docs/framework/solid/guide/hosting)
uses Cloudflare's Vite plugin with an SSR environment and the Start/Solid plugins.
[Cloudflare's environment reference](https://developers.cloudflare.com/workers/vite-plugin/reference/vite-environments/)
explains assigning framework Workers to `viteEnvironment.name: "ssr"`.
[Selective SSR](https://tanstack.com/start/latest/docs/framework/solid/guide/selective-ssr)
documents restrictive parent inheritance: leave root/layout SSR enabled.
[Solid Query's overview](https://tanstack.com/query/latest/docs/framework/solid/overview)
documents resource-based SSR support; exact Start hydration still requires proof.
The generic Router SSR/Query documentation redirected to React examples during
this audit; that is not evidence of a working Solid integration. Some direct doc
fetches timed out/returned 404; use installed exports plus the framework-specific
official example when Stage 1 pins versions. No React package/API is introduced.

Stage 0 harness APIs were checked against installed Miniflare/Playwright/Vite/Zod
types and exercised, including cache-preserving preview middleware. Cloudflare's
[Miniflare fetch](https://developers.cloudflare.com/workers/testing/miniflare/core/fetch/),
[D1](https://developers.cloudflare.com/workers/testing/miniflare/storage/d1/), and
[CPU profiling](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/)
references inform the local baseline; old Miniflare constructor examples do not
override this repository's installed v5 types.

These are foundation implementation gates, not unresolved product-scope choices.
If a compatibility proof fails, fix it within Stage 1 and record the exact version/
reason; do not silently substitute a second router, React or a Node-only runtime.
