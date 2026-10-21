# Stage 5: native typing route

Base: Stage 4 `2a66d1577`, PR #139; clean working tree, ledger and handoff
verified. Work stays on one child branch/PR, with small commits. Production
rollback remains available. No TUI or Stage 6 transport migration.

## Prerequisites and responsibility map

Stage 4 completed all phases and exit checks; its native index was the remaining
placeholder. Stage 5 moves typing orchestration, input/rendering integration,
route entry/exit and URL startup into `features/typing`. Start must never import
AppPages, Page, page-controller or NavigationRuntime. Engine algorithms,
telemetry, save transport and authentication policies stay unchanged.

Phases run in order: 5.1 lifecycle → 5.2 integrations/URLs → 5.3 validation.
**5.1–5.3 and Stage 5 exit complete.**
Stage 6 not started.

## 5.1 Session and lifecycle boundaries

Status: complete.

- Moved: browser orchestration around `packages/typing-core` (`ts/test/**` →
  `features/typing/runtime/**`), typing/result UI (`ts/components/pages/test/**`
  → `features/typing/components/**`). Engine, fixtures, telemetry unchanged.
- `features/typing/scope.ts`: Start leaf mounts one owned route scope; DOM-bound
  resources (`createTypingOwned`) die with it, serializable session state stays
  app-owned. Generation leases reject async initialization/continuations after
  disposal; duplicate mounts throw. Route activity is reactive (hotkeys, palette).
- `features/typing/lifecycle.ts`: explicit `enterTypingRoute` (preferences →
  reset incomplete → fresh restart) and synchronous `exitTypingRoute` (timers,
  pace caret, replay, session, funboxes, TTS, modifiers, composition, flags,
  pending frames). Returning never resumes. Rollback `pages/test.ts` hooks now
  only call these commands.
- `TypingEvents` (owned by `TestPage`) replaces typing parts of legacy
  `GlobalEvents`/`ModifierEvents`/`AppEffects`: autofocus, modifier/AltGr,
  focus-mode reveal, resize recentering, long-test unload prompt.
  `ModifierEvents` deleted. Host-neutral `GlobalEvents` and connection tracking
  now also mount in Start. Debug globals move to typing/platform runtimes.
- Start leaf portals funbox styles/CRT, bar timer, monkey power; all exit with it.
- Palette blur, polyglot restart and quick-restart key shifting use route
  activity instead of the never-set (in Start) legacy active page.
- Typing browser subtree declared client-only (`clientOnlyFeatureFiles`):
  Start server import protection denies it; layer test checks only client code
  imports it.
- Remaining adapter: rollback `AppPages` binds route activity from
  `getActivePage()`; `pages/test.ts` calls lifecycle commands. Both retire with
  the rollback entry in Stage 8.

Validation: route-scope, lifecycle, TypingEvents, quick-restart, layer and full
web unit suites pass; Start build passes with the stricter protection.

## 5.2 Browser integrations and URL settings

Status: complete.

- Native typing owns its input/composition/keymap, hotkeys/focus/scroll, word and
  caret refs, sound/TTS subscriptions, funboxes, challenges, result charts and
  screenshots. Route-local resource factories dispose subscriptions/timers;
  application state retains serializable session/preferences only.
- `url-settings.client.ts` observes committed typing-route search, then waits for
  local preferences, initial account/server preferences and entry restart. Raw
  URL bytes retain legacy `+`, compressed tuple, custom text, quote and funbox
  formats. Each search applies once; session refresh and intent preload never
  restart or reapply it. Browser handoffs remain pending through sign-in and
  open their form once. No TUI implementation changes.
- Readiness is explicit in account/auth owners. Ordinary guest input does not
  wait for authentication, account collections or history. The leaf activates
  after local preferences; loading those preferences cannot launch a second
  animated restart or discard the first typed letter. Code preloading only
  fetches modules; lifecycle and URL commands still require mounting.
- Generation/application leases reject late word generation, speech, pace/funbox,
  script challenge and result/chart/screenshot work after disposal. Pending
  result acknowledgements still persist for the same actor after navigation;
  account switches discard them. Retry state and save spinner belong to the
  account. Save transport, payload/hash, deduplication and policies unchanged.
- Start client import protection and source graph tests reject the rollback
  Page/controller/cache system. SSR protection rejects the whole browser typing
  subtree. The SSR document/common shell remain enabled.

Focused evidence: 20 feature/scope tests; 53 resource/funbox/pace tests; 153
completion/result component tests pass. Native browser parity and all stage
exit checks pass in 5.3. Performance fixtures now support built Start
readiness and native Start renderer measurements without changing frozen budgets.

## 5.3 Responsiveness and route behavior

Status: complete. [Command/results evidence](evidence/stage-5-validation.json).
All 20 local gate commands, formatting/whitespace and eight frozen browser
metrics pass. [Linux CI](https://github.com/voltcrash/oxytype/actions/runs/38869928648)
is green on `6d90361aa`: frontend, Start/workerd/browser, rollback
browser, format and knip. Backend/shared/assets pass locally; CI skips them and
TUI by path filter. Product code is unchanged from the earlier green implementation
`9d3eb57bf`; the final fixture correction is included in this run.

- Built Start browser suite: 59 pass (28 native route/auth/document checks,
  including 9 typing lifecycle cases, plus all 31 existing browser checks under
  Start). Covers words/quote/time, restart, command palette, modals, accessibility,
  screenshots, funbox cleanup, no_quit, pending save, auth loss and deep links.
- Focused tests cover disposal before preferences, application/remount isolation,
  delayed speech/script responses, forced navigation during completion, and
  cross-account acknowledgement suppression. Frontend: 234 files / 2,308 pass;
  backend: 803 unit + 124 real-D1 pass; shared: 54 files / 636 pass; built
  Start/workerd: 10 files / 50 pass.
- Original budgets unchanged. `stage-5-browser-budgets.json` is an exact extraction
  of eight original records for the Stage 5 browser gate; verified against
  `budgets.json`. It is not a new freeze or wider threshold. Every metric passes
  using the existing `migration-performance.ts check` command.
- Built native readiness: two runs of 10 cold + 10 warm + 10 public-page samples, no throttling,
  HTTP cache cold/warm and service workers bypassed. Native word rendering uses
  the same 1,000-word/12,000-letter fixture, 10 warmups + 50 retained samples,
  three sequential runs (150 samples); synchronous letter updates unchanged.

| Metric | Median / p95 | Frozen maximum median / p95 |
| --- | --- | --- |
| Cold first correct input, ms | 368.0 / 448.9 | 788.1 / 1170.5 |
| Warm first correct input, ms | 257.2 / 270.6 | 427.3 / 484.3 |
| Public about content, ms | 151.5 / 178.1 | 365.53 / 383.83 |
| 1,000-word render/layout, ms | 52.8 / 79.2 | 85.2 / 116.8 |
| Letter update, ms | 0.011 / 0.012 | 0.012 / 0.014 |
| Declared Start entry/preload JS, bytes | 382,366 raw / 128,635 gzip | 922,918 / 321,462 |

Rollback eager JS is also within its original budget: 80 declared responses,
916,624 raw / 321,106 gzip bytes. The Start staging Worker dry-run is
4,178.51 KiB raw / 931.71 KiB gzip, essentially Stage 4's recorded intermediate
4,178.04 / 931.66 KiB footprint.

Entry bytes are five repeated reads/gzips of the built document's 33 declared
entry/preload assets, matching Stage 0's definition. Lazy engine/chart chunks
are excluded; this is not a claim about all bytes before typing. Correct-letter
readiness measures the full observed startup. Worker CPU/D1/save benchmarks and
final native Worker footprint remain the owning later-stage gates; Stage 3/4's
recorded intermediate Worker-byte deviation is unchanged.

## Validation fixes and decisions

- Startup initially ran a config-triggered animated restart before entry's
  instant restart. That could lose the first typed letter. Activate only after
  local preferences; warm readiness falls from ~490 ms to ~256 ms. The benchmark
  now explicitly waits for typing opacity 1, matching the existing `openTest`
  helper and the baseline startup-cover behavior.
- Moved source paths made the generated operation inventory stale. Regenerated
  caller paths for the same 82 operations; policies, services and endpoints unchanged.
- Knip found one unused account-readiness accessor; kept it module-private.
- The expanded browser suite exceeded the real 60/minute session limiter when
  every test shared one edge IP. Failure traces showed HTTP 429. Fixtures now
  give each context a deterministic reserved test IP; all policies remain enabled.
- The rollback build clears the parent `dist` directory, including Start output.
  A dry-run attempted after it found no Wrangler file; rebuilt Start and reran
  normal/staging dry-runs successfully. This is the known coexistence build
  ordering, not an application regression.
- A final Linux rerun exposed a test helper assuming the first random word has
  three letters. Two-letter words produced two correct letters before any auth
  change. The helper now asserts and returns the actual typed count; the auth
  test uses supported custom text with a guaranteed two-letter first word and
  requires that exact count to survive session loss. Twenty repeated local
  auth-loss/navigation checks and the full corrected Linux run pass. No retry added.
- No pre-existing required test failure was observed. Existing non-fatal Vitest
  plugin/deprecation, Node module-type/NO_COLOR and fixture warnings remain.
  The existing quote-submit handoff depends on QuoteSearch's nested form;
  unchanged here. End-to-end handoff validation uses quote-report (opens once,
  never auto-submits), retaining pending behavior through login.
- Installed Solid 1.9.15, Router 1.170.41 and Start 1.169.2 source/types verified for
  lazy preloading, client-only imports, ownership cleanup and Router blockers.
  References: [Solid lazy preloading](https://docs.solidjs.com/solid-router/advanced-concepts/preloading),
  [Start environment functions](https://tanstack.com/start/latest/docs/framework/solid/guide/environment-functions),
  [Router blockers](https://tanstack.com/router/latest/docs/guide/navigation-blocking).

## Remaining adapters and next stage

| Adapter | Retirement condition |
| --- | --- |
| Rollback AppPages/Page/controller/NavigationRuntime; typing activity/transition binding and `pages/test.ts` command calls | Production rollback only; delete with old entry in Stage 8. Start cannot import this graph |
| Rollback `useUrlEvents` auth subscription and prepared-page challenge reveal | Old build only; native URL startup uses route/readiness. Remove with rollback in Stage 8 |
| App/account snapshot, Ape reads/mutations/result submission, browser handoff profile lookup and `/api/$` Hono handler | Stage 6 replaces callers with functions/shared services and ports retained external protocols; preserve result acknowledgement/deduplication policies |
| Deployment ownership, old service worker/PWA and legacy static delivery | Stages 7–8; no cutover performed |

Stage 6 can proceed from this PR after the stack lands: migrate remaining data,
ordinary mutations and finally submission, then retire web transport glue.
Retain the same result payload/hash, D1 transactions, auth/config/rate policy,
local acknowledgement behavior and real Worker/D1 save gate. No Stage 6 work
started here; no typing-core algorithm, TUI, backend service or static-warning
source change.

Reproduce browser performance with the commands below. Run sequentially on an
idle machine; never overlap builds (the rollback build clears `frontend/dist`).
The native renderer uses Start offline development to expose the same instrumented
renderer modules; readiness uses the built/minified Worker, as in the baseline.

```sh
vp -C frontend run build:start
vp exec env MIGRATION_BASELINE_OUTPUT=/tmp/readiness.json vp -C frontend run benchmark-migration:start
vp exec env WORD_RENDERING_BENCHMARK_OUTPUT=/tmp/words-1.json vp -C frontend run benchmark-word-rendering:start
# Repeat with words-2.json and words-3.json; concatenate all retained samples.
vp -C frontend exec tsx scripts/measure-start-eager-js.ts /tmp/start-eager.json
vp -C frontend exec tsx scripts/migration-performance.ts check ../docs/tanstack-start/evidence/stage-5-browser-budgets.json ../docs/tanstack-start/evidence/stage-5-browser-measurements.json
```

The checked-in sample comparison is reproducible from the versioned evidence;
candidate runs must replace the measurement arrays, never budget thresholds.
Production delivery and offline shell acceptance remain Stages 7–8.
