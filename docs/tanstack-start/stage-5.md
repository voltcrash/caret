# Stage 5: native typing route

Base: Stage 4 `2a66d1577`, PR #139; clean working tree, ledger and handoff
verified. Work stays on one child branch/PR, with small commits. Production
rollback remains available. No TUI or Stage 6 transport migration.

## Prerequisites and responsibility map

Stage 4 completed all phases and exit checks; native index is the remaining
placeholder. Stage 5 moves typing orchestration, input/rendering integration,
route entry/exit and URL startup into `features/typing`. Start must never import
AppPages, Page, page-controller or NavigationRuntime. Engine algorithms,
telemetry, save transport and authentication policies stay unchanged.

Phases run in order: 5.1 lifecycle → 5.2 integrations/URLs → 5.3 validation.
Status: 5.1 complete; 5.2 complete; 5.3 in progress. Required checks pending.

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

Status: complete; full exit validation pending in 5.3.

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
exit checks are rerun in 5.3. Performance fixtures now support built Start
readiness and native Start renderer measurements without changing frozen budgets.
