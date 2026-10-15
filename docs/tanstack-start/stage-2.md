# Stage 2: explicit state owners

Base: Stage 1 `3178bc19b`, PR #136. Initial worktree clean; Stage 1 exit,
ledger, CI gates and handoff prerequisites verified before editing. Baseline
`vp run test-fe`: 207 files / 2,231 tests pass.

Phases in order: 2.1 factories/import boundaries → 2.2 providers/browser
runtime → 2.3 preferences/data identity. Status: **in progress**.

## 2.1 Browser side-effect inventory

Reachable from the legacy entry (`src/ts/index.ts`), `auth-client.ts`,
collections, `hooks/effects.ts`, test modules and virtual configuration
imports at `3178bc19b`. "Import" = runs when the module is evaluated.

| Module | Side effect at import / bootstrap | Target owner |
| --- | --- | --- |
| `index.ts` | Locks/freezes `Math`, `window.Math` | Browser runtime integrity step, client only |
| `index.ts` | `applyEngineSettings`, `loadFromLocalStorage`, version fetch, `Focus.set`, auth `init` → cookie activation, `addToGlobal`, `render` | Browser runtime + preferences/auth owners; entry only renders |
| `queries/index.ts` | Module `QueryClient`; root effect resets `user` queries on boolean auth change | QueryClient factory per mounted app; account-data owner resets by actor |
| `collections/*.ts`, `collections/results/store.ts` | Collections bound to the module QueryClient; permanent reader subscriptions; HMR-only cleanup | Lazy collections per app + actor generation, disposed by account-data owner |
| `collections/results.ts` | Barrel + module effect refetching results on sign-in | Account-data owner (actor generation) |
| `auth-client.ts` | Better Auth client built from `window.location` + `virtual:env-config`; module user signal, `available` flag, `authPromise` | Auth session owner state; lazy client created by browser runtime |
| `auth.tsx` | Module memos per auth method | App-owned memo |
| `ape/user.ts` | Module effect clearing user cache on `getUserId` | Account-data actor scope |
| `ape/server-configuration.ts` | Module promise + rejection handler | Query state (readiness via query) |
| `config/lifecycle.ts` | `configLoadPromise` module promise | Preferences owner readiness state |
| `states/core.ts` | Actor signal (`getUserId`), module `Formatting` memo | Auth session owner; app-owned memo |
| `states/test.ts`, `live-stats.ts`, `settings-search.ts`, `result-filters.ts`, `leaderboard-selection.ts`, `hotkeys.ts` | `createModuleRoot` memos/resources/effects; `keymapEvent.useListener` outside an owner | App-owned memos; typing session runtime listener |
| `states/settings-sections.ts` | Module effects (auth-gated tab reset, URL replace) | Settings page lifecycle |
| `states/connection.ts` | `navigator.onLine` read, event subscription, `onDOMReady` banner | Component-owned connection runtime |
| `test/tts.ts` | Config + TTS event subscriptions; speech synthesis | Typing session runtime |
| `test/test-logic.ts`, `pace-caret.ts`, `practise-words.ts`, `result.ts`, `funbox/funbox.ts`, `controllers/{sound,challenge,quotes}-controller.ts` | Module config/restart subscriptions | Typing session runtime |
| `controllers/theme-controller.ts`, `commandline/lists/themes.ts`, `components/common/ChartJs.tsx` | Module config subscriptions | Theme / commandline / chart component lifecycles |
| `elements/psa.tsx`, `controllers/url-handler.tsx`, `components/modals/modal-triggers.ts` | Module auth-event subscriptions; PSA fetch; URL settings application | Account runtime / app effects lifecycle |
| `cookies.ts`, `anim.ts`, `utils/logger.ts`, `utils/json-data.ts` | Read `localStorage`/`window` at import; logger replaces `console.*` | Client-only modules; logger installed/restored by runtime |
| `sentry.ts`, `controllers/analytics-controller.ts` | Activation globals (called after consent) | Browser runtime consent step |
| `states/modifiers.ts` | Caps-lock library listener (no unsubscribe; HMR bridge) | Accepted: client-only, one bridge per document |
| `dev/signal-tracker.ts`, `virtual:devtools` | Opt-in dev instrumentation | Accepted: dev-only, legacy entry only |
| `virtual:env-config`, `virtual:language-hashes` | Pure build-time constants | Allowlisted browser config; no secrets |
| Standalone `oauth-callback/not-found/privacy-policy.tsx` | Hydrate on import | Legacy standalone entries only |
