# Stage 6: server functions and retained HTTP protocols

Base: Stage 5 `212ccb026`, [PR #140](https://github.com/voltcrash/oxytype/pull/140).
Stage 5 prerequisites and exit evidence verified; working tree clean at takeover
(`865c7acab`). All Stage 6 work stays in [PR #141](https://github.com/voltcrash/oxytype/pull/141),
stacked on Stage 5, in small commits. No Stage 7 implementation or TUI work.

Phases implemented in order: reads → ordinary mutations → result submission →
transport retirement. **Phases 6.1–6.4 and Stage 6 exit complete.**
Production still uses the preserved rollback build.

## 6.1 Read models and collections

Account, history/activity, tags, filter presets, presets, custom themes, inbox,
configuration/preferences, PSAs, quote ratings/moderation and auxiliary profile
reads use Start functions. Existing public/profile/leaderboard query factories
continue calling their native functions.

`queries/account.ts` owns the canonical actor account. `states/snapshot.ts` is a
QueryObserver view; `db.ts` exposes derived selectors and explicit cache writes.
Removed mutable snapshot storage. Tags/filter presets seed their actor-owned
collections from the same account request. Result acknowledgements update PBs,
XP, streak, activity, leaderboard memory and last-result state explicitly.
Favorites/profile changes update the current cached account without overwriting
other acknowledgements. Quote statistics and remote preferences have Query owners.

## 6.2 Ordinary mutations

Config sync, presets/tags/themes, profile/preferences, favorites/ratings, account
actions, inbox/reward claims, quote moderation/reporting and supported dev actions
call server functions. Collection optimistic changes retain rollback on failed
persistence; query invalidation/cache writes retain existing UI behavior.

The typed browser operation client captures application/account leases, preserves
JSON input semantics, and resolves expected policy failures with status/message/
validation details. Private replies after an actor change are rejected. Timeout
remains ten seconds (dev data generation: 240 seconds); no automatic replay.
Offline development returns the existing unavailable outcome before any RPC.

`backend/src/policies/operation-runner.ts` applies the same root/bad-auth limits,
fresh-session authentication, operation limits, config/permission/dev gates, input
validation, service and audited error mapping. The registry maps all 82 operations
to their existing services. No internal HTTP requests or duplicate business writes.

## 6.3 Result submission

Both signed-in result saving and signed-out-result recovery call `resultsAdd`, a
POST server function over the existing result service. Payload/hash generation,
bounded/decompressed bodies, anticheat, server-derived identity, bans/config/rate
gates, atomic D1 persistence, deduplication, progression/outbox and receipt DTOs
are preserved. Actor/route leases prevent late saves from changing another view.
Lost acknowledgements remain visible; explicit retry uses the same identity/hash.

Real built-Worker/D1 tests exercise PB/XP/streak/activity/leaderboard writes,
lost acknowledgements and retry, concurrent duplicates, cross-user hashes,
malformed/hash/telemetry rejection, auth/origin/config/rate/body gates and atomic
telemetry-storage failure followed by clean retry. Ordinary RPC tests also cover
preset ownership, fresh-session/moderator gates and one-time reward claims.

Browser fixtures use pinned Start/Seroval protocol responses. A real browser types
a complete test, saves through the Worker into D1, reads the account back and
asserts zero `/api/results` writes. Mocked save tests still cover presentation UX.

## 6.4 Transport retirement

Deleted browser Ape, lazy contract client, compatibility state/banner and obsolete
transport tests. Better Auth and device authorization remain HTTP protocols.
Rollback-only ts-rest binding lives under `src/rollback/` and is forbidden from
the Start graph. Contract imports used solely for DTO types remain erased.

Deleted Start's Hono catch-all bridge. Generated, explicit file-based Start routes
declare all 82 HTTP operations; each calls the same policy runner/service through
the framework-independent Request/Response adapter. The fallback only reports
unknown APIs/preflight. Native routes also own health, retained API docs and the
dev-only configuration editor. Preserved JSON errors, parsing/body limits,
cookie-origin and ApeKey policy, rates, CORS, version headers, conditional ETags,
HEAD, case/trailing slashes, maintenance and development slowdown.

The [operation ledger](operations.json) identifies current route, function,
browser caller, service, policy, lifetime and retirement condition for every
operation. Frozen Stage 0 classification: 35 retained external/operational
protocols; 47 temporary old-tab transports. OpenAPI includes only retained
protocols. Private editor sources stay server-only and development-gated.
Source/bundle tests forbid current client contract transports and Hono dispatch;
CI checks both the ledger and generated route bindings.

## Compatibility decisions

- Preserve former JSON response semantics before strict RPC DTO validation:
  omitted members, date strings and sparse calendar entries represented as null.
- Historical partial PB records receive missing empty modes in the service DTO,
  replacing the former browser fallback. Stored records remain untouched.
- Historical preferences/preset settings pass the existing shared pure config migration before
  modern schema validation. Malformed wrapped preferences retain their visible
  error; migrations perform no D1 rewrite. HTTP keeps its historical raw format.
- Docs use generated retained JSON and a small Redoc shell instead of embedding
  the spec in generated HTML. Preserve the existing Redoc 2.5.4 CDN URL, integrity
  hash, docs URLs/prefix and CSP. No new renderer dependency.
- Installed Start 1.169.2/router 1.170.41 APIs and official
  [server-function](https://tanstack.com/start/latest/docs/framework/solid/guide/server-functions)
  and [server-route](https://tanstack.com/start/latest/docs/framework/solid/guide/server-routes)
  documentation checked. Static server-function imports support compiler
  extraction; inspected installed serialized error/status and HEAD dispatch behavior.
- Corrected invalid browser account fixtures and the fixture's explicit ASSETS
  binding. No production data, migrations, typing-core algorithms or static
  `noscript`/`#nocss` fallbacks changed.

## Exit validation

[Command/result evidence](evidence/stage-6-validation.json).
All 13 PR checks pass on implementation/evidence head `5ea03dc`:
[CI run](https://github.com/voltcrash/oxytype/actions/runs/38910305413).
Only documentation/evidence handoff commits follow that run.

- Frontend: 236 files / 2,317 tests; backend: 804 unit + 124 D1 tests;
  shared packages: 54 files / 736 tests. Type-aware lint passes.
- Built Start/workerd: 14 files / 77 tests; browsers: 60 Start + 31 rollback.
  Real browser result submission persists once through Start/D1.
- Rollback, Start, runtime-test and staging builds pass; both Worker dry-runs
  pass. No deployment or production resource mutation.
- Knip, formatting, styles/assets, suppression/config checks, generated route
  bindings and all 82 operation ledger entries pass. Start source/bundle graphs
  contain no browser contract transport, rollback runtime or Hono dispatch.
- All eight original frozen browser budgets pass without changed thresholds:
  20 readiness samples per metric, 150 renderer/input samples and five eager-byte
  samples. [Budgets](evidence/stage-6-browser-budgets.json) are exact records
  from Stage 0; [measurements](evidence/stage-6-browser-measurements.json) and
  raw samples remain checked in. Eager JS: 380,739 raw / 128,003 gzip bytes
  (Stage 5: 382,366 / 128,635).
- Intermediate Worker artifact: 4,201.64 KiB raw / 930.10 KiB gzip. Final edge
  CPU/save latency/Worker footprint remain the Stage 7 cutover gate, as recorded
  in prior-stage handoffs; missing measurements are not passing measurements.

Earlier default-worker frontend runs hit the pre-existing commandline import
timeout under concurrent tooling. Isolated checks and the complete four-worker
suite pass without raising timeouts; full Linux CI also passes. No unresolved
required failures. Corrected fixture, DTO compatibility, unused-code and format
failures are recorded in the evidence.

## Remaining adapters and next-stage prerequisites

- Retain Start's 47 old-tab HTTP transports for **at least 30 days after last
  legacy HTML**, stale-tab acceptance, and seven days without supported legacy
  mutation traffic. [Release contract](release.md#compatibility-window) is unchanged;
  missing traffic evidence never means zero usage. External protocols stay indefinitely.
- Legacy Hono app/build and isolated browser HTTP binding serve the production
  rollback target only. Remove with the old entry in Stage 8 after verified cutover;
  Start neither imports nor dispatches through them.
- Legacy navigation/page/bootstrap bridges remain rollback-only until Stage 8.
- Stage 7 owns PWA/offline delivery, stale function IDs/assets/SW update and
  rollback acceptance, production build/deploy transfer, edge observability and
  final Worker/save-latency budgets. Preserve matching client/server artifacts,
  D1/queues/Cron/auth identity and explicit old-tab support during that work.
