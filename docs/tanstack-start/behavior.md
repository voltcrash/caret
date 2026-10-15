# Phase 0.1: behavior and consumer contract

Source snapshot: `d6e5be3e9`; no production changes in Stage 0.
Paths below are repo-relative. Start route names refer to the target architecture.

| URL/capability | Current owner/policy | Target owner | Validation / legacy retirement |
| --- | --- | --- | --- |
| `/` | `pages/test.ts`, `AppPages`, browser typing core | `_app/index` client-only typing leaf, session provider | typing/restart/time/quote + parity suites; remove Page hooks Stage 5 |
| `/about` | page controller; public aggregate queries | SSR route + functions | direct load, aggregate fixture, metadata; remove controller Stage 4 |
| `/leaderboards` | controller + leaderboard state; configuration gates | SSR first-page route; validated search + Query | leaderboard queries/D1 client rankings; remove selected filter mirror Stage 4 |
| `/profile` | public profile search | SSR search route | search/visibility tests Stage 4 |
| `/profile/:uidOrName` | controller selected profile; public visibility gate | route params + SSR public DTO, private controls separate | profile privacy/D1 tests; delete selected profile routing state Stage 4 |
| `/settings` | controller URL schema, highlight and tab state | stable SSR shell, client preferences; authenticated account operations | settings browser suite; remove PageWithUrlParams Stage 4 |
| `/login` | guest-only, authenticated → `/account` | server session redirect shell; browser OAuth | auth/D1 + popup tests; remove auth-event forced navigation Stage 3/4 |
| `/device` | web device approval UI, `oxytype-tui` client restriction; login needed to approve | SSR session shell, Better Auth HTTP route | existing device-auth D1 tests; preserve web behavior only |
| `/account` | authenticated-only, guest → `/login` | private layout/server checks; client-only charts, Query/history collections | history/client-selection + auth tests; remove snapshot page gate Stage 4/6 |
| `/account-settings` | authenticated redirect `/settings?tab=account`; original search keys override defaults, hash preserved; replaces history | explicit Router redirect with same merge order | NavigationRuntime tests; remove route alias machinery Stage 4 |
| `/privacy-policy.html` | standalone `src/privacy-policy.html` | SSR public route with literal-dot URL | direct URL/content/status Stage 1/4 |
| `/oauth-callback.html` | standalone HTML + callback script; popup handshake | minimal Start route, client completion | origin + popup source + random request ID verified; preserve URL Stage 3 |
| `/404.html`, unknown URL | standalone page; extensionless SPA fallback can return 200 | Start not-found document with HTTP 404 | deliberate status correction in plan; direct document checks Stage 4 |
| `/index.html`, `/index`, `/privacy-policy`, `/oauth-callback`, `/404` | public build entries / Worker extensionless `.html` lookup | explicit redirects to canonical `/`, `.html` routes | preserve query/hash; no additional standalone source entries found |
| Trailing slash, encoded profile ID, hashes | Router + `api/path.ts` case/path normalization; Worker rejects encoded separators/dot escape | validated Router params/search + server-route normalization | navigation/path HTTP tests; preserve malformed URL rejection |
| External/modified/download links | `Link`, router-marked buttons, LinkPrefetch + global events | Router links and native anchors | keyboard/back/forward/modifier/accessibility; delete custom prefetch Stage 4 |
| Downloads | client-generated results CSV, settings JSON, saved text, event log and screenshot; static language/quote/font/theme assets | feature-owned client download/canvas; public static assets | existing modal/screenshot checks; no invented HTTP download endpoint |
| Release/version/PWA | `/version.json`, `/release.json`, `/manifest.json`, `/sw.js`; `AppEffects`, Vite PWA | Start build + owned browser runtime, Stage 7 worker | no private response caching; release assets NetworkOnly |
| Static fallbacks | `src/html/warnings.html` noscript + `#nocss` | root document preserving static source | must work before hydration/without scripts or CSS |
| Overlays/commands/preferences | global modal/toast signals, component refs, stored config | root UI/preferences providers | modals/commandline/a11y tests; dispose subscriptions/restore focus |

Search/deep-link compatibility:

- `states/leaderboard-selection.ts` defines leaderboard URL schema; `states/settings-sections.ts`
  defines settings tabs. Preserve schema defaults and JSON URL encoding through
  `zod-urlsearchparams`; settings `highlight` selects/scrolls to setting.
- `useClientSelection` validates `client=web|tui`; preserve exposed historical
  client selection in account/profile/leaderboards. No TUI development required.
- `controllers/url-handler.tsx`: `testSettings` is URI-compressed JSON tuple;
  retain old custom-text fields, hash-separated funboxes, selected quote IDs.
  `customTheme` is base64 JSON (`c`, optional `i/s/f`); retain decoding/error UX.
  `challenge` is case-insensitive. URL settings must not apply during preloading.
- Browser handoffs use `terminalAction` with schema-validated action payload;
  retain pending action through login, open form once, never auto-submit. See
  `packages/schemas/src/browser-handoff.ts` and existing controller tests.
- Device review uses `user_code`; popup uses `requestId` and provider error params.
  OAuth provider callback remains `/api/auth/callback/github` (Google only when enabled).

Lifecycle contract:

- Test `beforeHide` blurs input; `afterHide` restarts without animation and clears
  funboxes. `beforeShow` resets incomplete-test counters and restarts without
  animation. Returning does not resume an active test. Refs/timers belong to the
  mounted route; serializable preferences/session data may survive separately.
- Navigation blocks restart/calculation/transition unless forced. Active
  `no_quit` blocks even forced navigation. Do not silently strengthen this to a
  blanket save lock: characterize save-in-flight separately at Stage 5.
- Bootstrap starts local configuration and auth in parallel. `AppEffects` waits
  for local config before displaying the app; server config sync is independent.
  Auth triggers forced page navigation and account loading; account snapshot,
  presets/tags and collection imports precede remote settings. Full result history
  is not an intended input-readiness dependency (preserve this in Start).
- Settings order: migrated defaults/local `config` → authenticated server config
  (waits local config + account readiness) → URL theme/test/challenge after auth
  load promise. Apply dependency-ordered settings (`lastConfigsToApply`), retain
  all existing local storage keys/migrations and nosave behavior. Today auth
  refresh can reapply URL settings; Stage 5 deliberately makes that one-time.
- Auth updates user ID; logout clears snapshot. Query currently resets `user`
  keys on boolean authenticated changes, while `ape/user.ts` cache keys by user
  ID. Boolean-only account switching is a known boundary risk, not evidence of
  safe account isolation. Start must key/reset by actor ID and dispose browser
  collections on every switch; never share QueryClient/router across SSR requests.
- Result saving clones/hashes payload, trims telemetry beyond 122 seconds,
  applies PB/XP/streak/tags only on acknowledged save. Guest/offline typing is
  supported; backend failures remain visible. Ape maps network failure to 500;
  retry stores one result in memory with explicit button. No durable replay queue
  or automatic reconnect upload. Codes 460/461/463/464/465/466 disable retry.
  Keep server deduplication and atomic progression; never dual-submit transports.

## HTTP operations and non-HTTP consumers

[operations.json](operations.json) enumerates every **82** ts-rest operation:
method/path, backend owner, exact merged policy metadata, browser callers,
validation/status contract, target transport and adapter retirement condition.
Generate/check with `vp -C backend exec tsx scripts/migration-inventory.ts [--check]`.
Caller extraction supports multiline Ape calls; OAuth's direct `/users` GET is
explicitly included. It is static source evidence, not production traffic analytics.

Public/ApeKey endpoints are published by `backend/scripts/openapi.ts` and the
Redoc public filter. Retain their HTTP contracts even when the web caller moves
to functions. No deployment traffic logs or external-consumer registry is in this
checkout: actual third-party use is **unknown**. Conservatively keep endpoints
with no browser caller (admin, ApeKey management, config administration, developer
helpers and unused reads). This resolves scope for foundation without claiming
they are unused. No endpoint is approved for unconditional deletion in Stage 0.

| Additional operation | Current policy/callers | Target / validation / retirement |
| --- | --- | --- |
| `/api/auth/*` | Better Auth; social signin/link/unlink, get-session/list-accounts, signout, device/code/token/review/approve/deny, dashboard | auth server route; delegate untouched body/cookies, preserve all Set-Cookie; direct auth + device D1 suites Stage 3 |
| `/api/auth/cancel-sign-up` POST | session required; origin checks, 409 if application user exists | auth route over shared service; retain cancellation semantics |
| `/api` GET (API-only `/`) | health/version/uptime; maintenance + root limiter/context | retained health route, HTTP tests; remove legacy dispatcher Stage 7 |
| `/api/docs/{internal,internal.json,public,public.json}` | static OpenAPI/Redoc; docs root serves public HTML | retained docs/download routes, regenerate external contract only Stage 6 |
| `/api/configure[/*]` | dev-only static config UI; uses configuration GET/schema/PATCH | dev server route/static asset; retain dev/admin policy; exclude prod |
| Queue consumer | `runtime/tasks.ts`: validated outbox/job IDs, leases, retries/idempotency, `withRuntime` per invocation | Worker queue → jobs/services; tasks/reward D1 tests Stage 1/2/7 |
| Scheduled consumer | every minute dispatch/recovery, 15-minute aggregates, hourly cleanup | Worker scheduled → jobs/services; preserve Cron, IDs, claims, retention |
| External quote approval bridge | outgoing HTTPS `INTEGRATION_URL`, bearer secret + Idempotency-Key, allowlisted repository | retained integration service/job; no inbound webhook found; retries and bridge contract remain |

Common policy inheritance for every operation: 100 KiB raw/decompressed body
limit; strict JSON/form parsing/charset and encoding errors; CORS, security headers,
cookie-origin CSRF; compatibility header; config/request context; bad-auth and
root rate limits; maintenance (configuration exception); endpoint authentication,
rate/config/permission metadata; Zod path/query/body validation (422), error IDs,
audit and response status/envelope/ETag behavior. Better Auth bypasses legacy
body parsing, owns its CSRF/cookie/rate behavior, adds explicit origin checks with
validated native device/bearer and signed dashboard exceptions. Preserve trusted
CF IP policy (dev-only forwarded fallback), IPv6 /56 and fresh-session <60s rules.
Developer operations also require `onlyAvailableOnDev()` in `api/routes/dev.ts`; controller checks (captcha, bans, privacy, quota and validation) must move into services alongside metadata policy. The request limiter currently numbers identities by construction order: replace
with stable operation keys in Stage 3; do not accidentally reset limits per request.

Remaining adapters: Hono entry + path/ts-rest/controller adapters (Stage 2/3/6/7),
Ape/lazy-client/compatibility banners (Stage 6), page controller/NavigationRuntime/
AppPages (Stage 4/5/8), global auth/config startup and snapshot/collections
(Stage 2/5/6), Vite HTML injection/static dispatch/PWA/prepare-site (Stage 7/8).
Retire only when native Start owns the responsibility and parity tests pass.
