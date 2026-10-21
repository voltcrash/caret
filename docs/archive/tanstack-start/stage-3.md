# Stage 3: services, policies and authentication

Base: Stage 2 `94edbf0a3`, PR #137. Stage 2 handoff/prerequisites verified.
Initial changes: three untracked context/auth/operation files from the interrupted
run; reviewed and completed. No unrelated changes. Production rollback retained.

Phases completed in order: 3.1 services/policies → 3.2 Start adapters →
3.3 native auth. **Stage 3 complete, with the measured Worker-byte deviation
below.** Stage 4 not started.

## 3.1 Services and policies — complete

- All controller business operations moved to `backend/src/services/operations`.
  Services accept `ServiceContext` (invocation runtime, request ID, background
  capability, server actor, config, trusted client) plus
  validated domain inputs. No Hono, MonkeyRequest, HttpRequest or raw headers.
- Deleted the controller tree and `MonkeyRequest` type. Legacy Hono routes
  dispatch directly to services through one typed `callService` adapter. DAL,
  atomic mutation/ranking/anticheat, deduplication and jobs remain shared.
- Auth, permission, configuration and rate rules extracted into `policies`.
  Operation IDs derive from contract keys; named rate buckets preserve shared
  limits across transports without module/instance-order identities.
- Public typing stats and authenticated account stats proved first in built
  workerd, before expanding extraction. Start calls services directly.
- Stage 1's separate public-stat service and ad-hoc Start rate implementation
  removed. Audit IP now uses resolved trusted IP rather than trusting raw headers.
- Validation: existing auth 25, permission/config 29, public/user/app/misc 188
  tests pass; phase-checkpoint backend unit suite 44 files / 801 tests passes. Service
  boundary tests pass. D1 fixtures updated to call services with typed contexts
  instead of incomplete cast legacy requests; signup/privacy checks pass.

## 3.2 Start policy adapters — complete

- Shared runner enforces authentication, fresh sessions, permission/config and
  maintenance gates, root/named/bad-auth rates, parsed contract inputs and safe
  response DTOs. Unknown failures are redacted and audited with request ID.
- Start function validation maps malformed inputs to 422; explicit CSRF middleware
  rejects direct originless/cross-site RPCs. No layout visit required.
- Worker retains 100 KiB streamed/compressed ceilings, charset/encoding failures,
  security/no-store headers, request IDs and structured request logs. Better Auth
  receives its original body bytes. Rate/compatibility/retry headers retained.
- Built workerd: guest/private/revoked/expired/fresh/admin, config/maintenance,
  operation/root/bad-auth rates, trusted-IP spoofing, origin, malformed input,
  gzip bomb/unsupported encoding checks pass. Worker + document + service suites:
  3 files / 16 tests pass. Outbound HTTP rejected by the harness.


## 3.3 Start authentication flows — complete

- Native `/login` and `/device` routes own session shells and client-only auth UI.
  Signup completion invokes the extracted account service through a server function;
  cancellation preserves existing dismissal behavior and refuses completed profiles.
  Retryable signup failures keep the social identity/session.
- `features/auth` owns client creation, popup/ref cleanup, callback presentation,
  UI observation and login/link/unlink/reauth/logout actions. Legacy components
  re-export shared presentation/client code for rollback only.
- Safe session DTO includes only UID/email/display name, supported provider labels
  and registration status. No tokens, session records or provider credentials.
  `requireSession` supplies a tested redirect guard; services still independently
  authorize every private call. Private-page layout attaches in Stage 4.
- `/api/auth/*` delegates original body bytes and all cookies to the same Better
  Auth construction, origin/IP rules, prefix, secret and tables. Cookie continuity,
  logout/revocation/expiry and cancellation tested in workerd; no schema changes.
  OAuth callback URL/origin/source/request-ID validation and device consent kept.
- Query owns native session observations; one shared app-owned actor signal adapts
  remaining browser components. UID changes cancel/remove private data and rotate
  collection scopes. Native startup no longer calls legacy auth callbacks, account
  snapshots, auth events or forced page reloads. Browser tests count document loads.
- Platform setup is shared; native auth and rollback observers have separate entry
  graphs. Public hydration/navigation remain independent of browser setup/history.
- CSP explicitly allows Turnstile. Start forwards only public provider/site-key
  settings; binding secrets stay server-only. Exact RPC tests use pinned Seroval
  1.6.9 as a dev dependency, matching Start's installed serializer.


## Remaining adapters and retirement conditions

| Adapter | Retirement |
| --- | --- |
| Hono HTTP/ts-rest parsing and `callService` | Stage 6 replaces browser callers and ports retained external protocols; no controller/business implementation remains here |
| Browser Ape reads/writes | Stage 6, except migrated signup/session and public read; authenticated stats function is a verified pilot awaiting a page caller |
| Legacy `auth.tsx` callback pipeline + `auth-client.ts` init/refresh | Rollback-only entry; native auth never calls it. Retire with Stages 4–6 callers / Stage 8 rollback deletion |
| Legacy callback/OAuth/device component re-exports | One native feature implementation; re-exports retire with the rollback entry |
| Legacy page/navigation/typing lifecycles | Stages 4–5; unchanged typing engine, storage and fallback HTML |

## Decisions

- Contract input/response DTOs retained during extraction; contracts move to
  external-only ownership as callers migrate in Stage 6.
- Rate keys change once from `limiter:<sequence>` / `start:*` to `rate:<name>`.
  Existing shared limit groups (e.g. userGet) retained. No schema migration.
- Guard implementation is ready/tested; no empty pathless layout is registered
  before Stage 4 supplies children. Pinned generator treats a childless pathless
  leaf as `/`, conflicting with the typing index. No account page was migrated.
- Public/auth routes needed for Phase 3.3 moved now; other non-typing route work
  stays in Stage 4. Production origin/deployment ownership remains Stage 7.
- Official APIs checked alongside installed Start 1.169.2, Router 1.170.41,
  Solid Query 5.104.0 and Better Auth 1.7.7 sources/types:
  [Start middleware](https://tanstack.com/start/latest/docs/framework/solid/guide/middleware),
  [authentication](https://tanstack.com/start/latest/docs/framework/solid/guide/authentication),
  [Better Auth integration](https://better-auth.com/docs/integrations/tanstack),
  [session management](https://better-auth.com/docs/concepts/session-management),
  [QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient).
- Frozen Worker byte exception: 4,519,986 vs 4,517,181 (+2,805; 0.062%).
  Required shared policy/context adapters add unminified source overhead. Removing
  all per-controller wrappers reduced it; gzip is **823,990** vs the frozen
  822,854 (+1,136; 0.138%), only +423 vs Stage 2. Figures use the repository
  benchmark's Node zlib compressor; Python zlib differs and is not comparable.
  Budgets unchanged; carry this explicit shared-extraction byte exception to
  Stage 7 artifact review. No typing/eager-byte budget increase.

## Exit validation

All required functional exit checks pass. Full command/results inventory:
[validation](evidence/stage-3-validation.json). Raw performance samples and the
[comparison candidate](evidence/stage-3-measurements.json) are retained; frozen
budgets were not edited.

| Check | Result |
| --- | --- |
| `vp run test-fe` | 225 files / 2,273 tests pass |
| `vp run test-be` | 45 unit files / 803 tests + 30 real-D1 files / 124 tests pass |
| `vp run test-pkg` | 7 workspaces / 54 files / 636 tests pass |
| `vp run test-e2e` | 31 pass |
| `test:start` | 8 files / 35 tests pass, including direct compiled RPCs and real sessions |
| `test:start:browser` | 9 pass, including popup login, logout, expiry and signup dismissal |
| `lint-fe`, `lint-be`, `lint-pkg` | type-aware/type-check pass, `--format agent` |
| `knip`, `lint-styles`, `check-assets`, `lint-suppressions` | pass |
| Source formatting / inventory freshness / diff whitespace | pass; all 82 service owners recorded |
| Production rollback build + backend docs/assets/Worker build | pass; no circular imports |
| `build:start`, `build:start:test`, local dry-run | pass |
| `build:start:staging` + dry-run | pass; 3,590.24 KiB upload / 785.24 KiB gzip |
| Rollback browser graph / production Start Worker graph | pass; no server/RPC code in rollback JS; no test probes in production Worker |
| Frozen performance comparison | timing, query-count and eager-byte metrics pass in repeat candidate; Worker raw/gzip failures explained above |

Repeated measurements (median / p95, milliseconds): cold input 414.2 / 585.4;
warm 369.6 / 390.9; `/about` 330.6 / 344.6; 1,000-word render/layout 52.9 / 83.3;
letter update 0.011 / 0.013; Worker startup 209.4 / 247.8; persisted save 13.0 /
24.0. Eager JS: 81 entry/preload responses, 913,298 raw / 320,903 gzip, within
922,918 / 321,462 freeze. All 50 saves persist per Worker benchmark run. D1
counts unchanged: configuration 4, public stats 6, account 19, history 7 (empty
and 10 rows), result saves median 18 / p95 20.

Timing investigation: initial CPU p95 was 7.8 vs 7.48, initial warm/about p95
509.6 / 399.3 vs 484.3 / 383.8, and first letter-update p95 0.032 vs 0.014.
Subsequent runs reproduce baseline behavior without code/threshold changes:
paired quiet Stage 2 CPU 6.6 / 7.0, Stage 3 6.4 / 7.2; full readiness repeat and
two independent 50-sample typing repeats pass. This supports local timing
variance; all diagnostic samples remain in evidence rather than being deleted.
Typing implementation and benchmark are unchanged. The initial Stage 2 control
overlapped builds; its absolute symlink labels inflated bytes. The quiet control
normalizes only those labels and matches recorded Stage 2 bytes exactly. The
word-rendering control emitted icon-font serving warnings, so it is diagnostic,
not the final comparison candidate. Local process CPU includes D1; Stage 7 still
must collect edge telemetry.

Regressions found and fixed: malformed-URL handling briefly returned 500 because
the bad-auth adapter initialized runtime too early; minimal policy context
restores 400. Browser fixtures now enable signup and use independent cancellation
sessions. Contention-related palette/path-override timeouts pass focused and full
suite reruns without timeout increases. No unresolved functional failures. No
production deployment; remote CI is reported separately in the PR.

## Next stage prerequisites

Stage 4 attaches private layouts to `requireSession`, uses safe session/query
ownership and shared services, and migrates remaining non-typing routes. Keep
`ci-start` green. Preserve the rollback build and explicit HTTP retirement list.
Do not migrate typing/result transport as part of Stage 4's auth handoff.
