# Stage 7: offline, delivery and observability

Base: Stage 6 `170bae84e`, [PR #141](https://github.com/voltcrash/oxytype/pull/141).
All Stage 7 work: [PR #142](https://github.com/voltcrash/oxytype/pull/142), stacked
on Stage 6, in small commits. Stage 6 ledger/prerequisites verified at takeover.
Claude's committed 7.1 foundation retained; its four modified files and new
version test reviewed and completed. No TUI changes. No Stage 8 production cutover.

## Phase status

| Phase | Status |
| --- | --- |
| 7.1 PWA/offline | Implemented; focused units and Chromium offline visit pass |
| 7.2 Delivery | Implemented; real production build/validated dry-run and artifact guards pass |
| 7.3 Production acceptance | In progress; exit checks and staging evidence pending |
| Stage 7 exit | Pending; never infer completion from implementation alone |

## 7.1 Offline ownership

Start emits the shared manifest, one build ID in client/Worker/version.json,
and a service worker generated from its actual chunk graph. Guest typing roots,
CSS/fonts and default English assets are precached. Shell fetch omits credentials
and requires the same build header. Runtime caching uses explicit public asset
paths; auth, functions, APIs, mutations and private HTML never enter caches.
Private/off-route offline documents receive a script-free 503 with a typing link.
No result replay was added. Existing save failures remain visible.

Replacements wait for the page, including legacy workers and evicted caches.
Update/reload guards cover typing, calculation/restart and both result-save
callers. Stale function IDs produce a 409 signal; stale chunks trigger a version
check and a reload prompt. Network failure alone never authorizes activation.
Late controller takeover defers a requested reload until safe. Keep one previous
Start cache plus first-transition rollback hashed assets. Release notes no longer
purge Start caches. Static warnings/cache recovery remain intact.

## 7.2 Delivery ownership

`frontend/wrangler.production.json` and `wrangler.staging.json` preserve Worker
names, origins, account/D1 IDs, queues/DLQs, Cron and authentication identity.
Node compatibility retained for Start. Generated client assets bypass Worker
dispatch; documents/functions/routes belong to Start. No SPA/static HTML dispatch.

Root build/dev/start now use Start. Frontend owns production/staging builders,
credential/public-input checks, immutable artifact receipts and deployment.
Production/staging checks reject a mismatched environment or changed file. One
uncached compiler invocation emits matching client/server/SW/version files;
preview credentials are removed from the retained artifact. Backend keeps schema
history, services and rollback validation. Deleted `prepare-site.ts`, backend
production config and legacy deploy/copy scripts. No destructive migration.

Backend changes trigger application validation. CI builds/dry-runs staging and
production configs. Release ordering: exact-SHA CI → build → validate/dry-run →
archive matched artifact → compatible migrations → deploy → publish release.
`START_PRODUCTION_ENABLED=true` deliberately gates scheduled/manual production
release until Stage 8 acceptance. Existing Actions secret names are unchanged;
private settings now materialize in frontend. Archive retention: 90 days.

Minifying the SSR build fixes the carried Worker-size regression: initial actual
production dry-run is 1,969.26 KiB raw / 559.01 KiB gzip, below frozen Stage 0
4,517,181 / 822,854-byte ceilings. Final measurements follow acceptance.

## Remaining adapters

Rollback Hono/browser entry and source remain validation targets until Stage 8.
Start has no dependency on that dispatch. Keep 47 old-tab HTTP transports for the
[frozen compatibility window](release.md#compatibility-window); external protocols
remain. Actual production is unchanged during Stage 7.

## Validation and deviations

Focused offline/update/version/build units pass; Chromium proves guest typing
after one visit with a signed-in browser and exclusion of private documents/RPCs.
Production credentials were available in the main checkout's ignored files;
copied privately into this worktree without rotating identity or logging values.
Production builder and credential-aware dry-run pass. Artifact tests reject
changed server/client files, added assets, wrong public settings and wrong build
identity. Staging checks reject the production artifact and vice versa.

Final suites, metrics, staging deployment/update/rollback evidence and next-stage
prerequisites remain to be recorded. No required check is claimed complete yet.
