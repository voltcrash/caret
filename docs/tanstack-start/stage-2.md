# Stage 2: explicit state owners

Base: Stage 1 `3178bc19b`, PR #136. Initial worktree clean; Stage 1 exit,
ledger, CI gates and handoff prerequisites verified before editing. Baseline
`vp run test-fe`: 207 files / 2,231 tests pass.

Phases in order: 2.1 factories/import boundaries → 2.2 providers/browser
runtime → 2.3 preferences/data identity. **Stage 2 complete.** Stage 3 not started.

## 2.1 Factories and import boundaries — complete

- `app/application.ts`: one mounted browser application per document;
  mounting during SSR throws, reads outside a mount fail explicitly.
- Legacy module `QueryClient` deleted; `createQueryClient` factory (Start
  router per request, legacy app per mount) provided by `AppProviders`.
- Collections/readers construct on first use inside the app's account-data
  scope (`app/account-data.ts`, `app/scope.ts`) and dispose with it.
- `lockMath` (`app/browser-integrity.ts`) is browser-only and idempotent.
  Better Auth client is built on first browser use (`getAuthClient`).
- Import protection fixed: Start matches root-relative paths, so Stage 1's
  `**/frontend/src/ts/...` server denials never matched, and a custom client
  list had replaced the default `.server` denial. Now: all `src/ts/**` denied
  on the server except `vite-plugins/import-boundaries.ts` allowlist;
  `**/*.server.*` + backend denied in the client. Negative builds prove both.
- Source layer test: server ↛ app/legacy/routes; legacy ↛ server/backend;
  SSR-rendered app/routes import only the SSR-safe legacy allowlist.

### Browser side-effect inventory

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

## 2.2 Providers and browser runtime — complete

- Start root mounts app providers with its router-owned QueryClient. Browser
  runtime loads through Start's client-only boundary, after hydration. Rollback
  uses the same owners; its entry now only renders and disposes on HMR.
- Preferences, auth observation, domain signals/stores/memos, overlay state and
  typing-session signals are lazy app-owned state. Removed module effect roots
  and auth/config startup promises; readiness exposes idle/loading/ready/error.
- Component lifecycles own event subscriptions, consent activation, logger/debug
  installation, version checks, speech/audio and their teardown. Audio closures
  belong to one app; cleanup unloads sounds and closes its audio context.
- LegacyRuntime retains page/auth-event wiring until Stages 3–5; TypingRuntime
  moves into the native typing leaf in Stage 5. Engine/DOM algorithms unchanged.
- Validation: frontend 215 files / 2,248 tests pass; focused owner/readiness and
  runtime remount/late-version checks pass. Start production build passes;
  client-only boundary removes browser runtime from SSR. Final stage gate reruns
  builds and workerd/browser checks after Phase 2.3.
- APIs checked against installed Start 1.169.2 / Router 1.170.41 / Solid 1.9.15
  and official execution-model, onMount and runWithOwner documentation.

## 2.3 Preferences and data identity — complete

- Local config migration/schema, IndexedDB database/version/store names, language
  hashes and config metadata remain unchanged. Local → server → URL precedence
  remains explicit in the preferences/auth runtime; history prefetch is detached
  from guest readiness. Start observes sessions without fetching legacy snapshots.
- Account-data scope keys private queries by actor + generation, retaining the
  existing web/TUI history dimension. Every UID transition (including direct A→B,
  logout and re-login) aborts requests, cancels/removes private queries and disposes
  collections/readers, raw + mini snapshots and private pending work. Public caches
  survive. Leases reject late results even if an endpoint ignores AbortSignal.
- Remote preferences, user load, result acknowledgement, inbox/reward work and
  debounced private writes capture their actor. Mutable palette trees, private
  suggestions, validation and pending input work also reset with the actor.
- Actual TestSession, words, timer scheduler, formatting, event recorder, DOM
  bridges and IndexedDB connection are lazy per app and released on unmount.
  Module imports cannot create a session or open the database.
- Start emits a small nonce-bearing early theme script using only the existing
  validated palette cache. Font CSS/loading belongs to FontRuntime after mount.
  Browser runtime has its own Suspense boundary so downloading setup cannot
  suspend SSR public content/navigation. Static warnings.html remains unchanged.

## Remaining adapters and retirement conditions

| Adapter | Owner / retirement |
| --- | --- |
| LegacyRuntime auth callback, URL/PSA, debug/focus/page wiring | Owned browser lifecycle; replace during Stages 3–5 |
| TypingRuntime, test DOM bridges and legacy signal accessors | Owned app/component resources; mount inside native typing leaf in Stage 5 |
| Ape/ts-rest lazy HTTP clients with app/actor leases | Compatibility transport; replace by direct server functions in Stage 6 |
| Browser Better Auth observation and auth routes | Server remains authority; Stage 3 owns auth policy/service migration |
| Rollback router, page cache, legacy entry/build and Hono delivery | Production rollback until Stage 7; final deletion Stage 8 |
| Caps-lock document/HMR bridge | Library has no unsubscribe; one bridge per document, owned callbacks detach |

## Significant decisions

- Audit expanded to actual typing engine/session state, IndexedDB connection and
  palette caches: moving only reactive UI flags would leave mutable singletons.
- Optional audio, account header, consent modal and result subscriptions load only
  when used. Shared owner modules share a rollback chunk. This keeps the frozen
  eager-byte budgets without changing typing algorithms or hiding eager imports
  from the measurement tool.
- Supported Better Auth client/infra imports include generic core/env getter
  names (including BETTER_AUTH_SECRET), without Worker binding values. Bundle
  guards check application-specific backend DB/runtime markers and browser-only
  setup in the correct graph. Import protection and runtime secret-leak checks
  remain enforced. [Official client API](https://better-auth.com/docs/concepts/client)
  and installed 1.7.7 / infra 0.4.14 sources checked.
- No server service/auth-policy transfer, schema change, deployment or TUI work.

## Exit criteria

| Criterion | Evidence |
| --- | --- |
| Importing server routes cannot initialize browser stores | Import protection denies `src/ts/**` on the server (negative builds); layer test; browser setup markers only in client chunks |
| Independent SSR requests cannot share user data | Request-local router/QueryClient; `mountApplication` throws under SSR; distinct concurrent actors in workerd |
| Remount/HMR does not duplicate listeners | Owner/runtime remount tests; browser suite 0 unowned-computation warnings (120 at Stage 2 start) |
| Guest typing independent of account/history | Runtime mounts without awaiting history; Start public hydration with setup blocked; readiness budgets below |

## Final validation (head)

| Check | Result |
| --- | --- |
| `vp run lint-fe` / `lint-be` / `lint-pkg` | pass |
| `vp run test-fe` | 223 files / 2,264 tests pass |
| `vp run test-be` | 44 / 801 unit + 30 / 124 real-D1 pass |
| `vp run test-pkg` | pass |
| `vp run test-e2e` | 31 pass; 0 unowned-computation warnings |
| `vp run knip` / `lint-styles` / `check-assets` / `madge` | pass |
| `vp fmt frontend/src backend/src --check` | pass |
| Production rollback build (baseline env) + `build-be` | pass |
| `build:start`, `build:start:test`, `dry-run:start` | pass |
| `test:start` (foundation, layers, protection, worker, document, bundle) | 6 files / 25 tests pass |
| `test:start:browser` | 5 pass |
| `build:start:staging` + dry-run | pass |
| Frozen budgets ([candidate](evidence/stage-2-measurements.json)) | all timing/query/eager budgets pass; Worker bytes see below |

Medians (p95) vs budget: cold input 420.5 (575.5) / 788.1; warm 370.1 (400.8)
/ 427.3; `/about` 332.8 (354.4) / 365.5; 1,000-word render 53.1 (80.8) / 85.2;
letter update 0.011 (0.012) / 0.012. Eager JS 913,412 raw / 320,898 gzip
(budget 922,918 / 321,462), now 81 entry/preload responses (was 63).

- Worker bytes 4,517,700 raw / 823,567 gzip exceed the frozen 4,517,181 /
  822,854. The legacy backend Worker is **byte-identical** to Stage 1 head
  `3178bc19b` (rebuilt and compared); Stage 2 changes no backend source. This
  is Stage 1's recorded shared-extraction deviation, not a Stage 2 regression;
  budgets left unchanged.
- Found and fixed at the gate: `Anime` read a derived `exit` prop during
  cleanup, creating unowned memos (last browser warnings). Regression test added.
- Intermittent: `settings.spec.ts` Tab quick restart failed 3 times right after
  source edits (click during a still-loading dev page). Not reproduced in 120
  later runs at head nor 80 at Stage 1 base; full suite passes.

## Next stage prerequisites

Stage 3 may start: app owners, actor-scoped private data, client-only browser
runtime and enforced import boundaries are in place. Stage 3 keeps `ci-start`
green, adds server services/policies behind `*.server.ts`, and replaces the
browser-only auth observation adapters listed above with Start-owned flows.
