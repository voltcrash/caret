# Stage 6: server functions and retained HTTP protocols

Base: Stage 5 `212ccb026`, PR #140. Stage 5 prerequisites and exit evidence
verified; working tree clean at takeover (`865c7acab`). One stacked Stage 6 PR,
small commits. Production rollback remains available; TUI and Stage 7 excluded.

## Responsibility and phase status

- 6.1 in progress: policy/service registry and server-function read definitions
  committed; account Query replaces mutable global snapshot. Remaining collection,
  preferences, quote/admin and auxiliary profile reads still use Ape.
- 6.2 pending: ordinary mutation definitions exist; browser callers still use Ape.
- 6.3 pending: both result submission callers still use HTTP. Move these last;
  retain payload/hash, policies, atomic persistence, retry and acknowledgement UX.
- 6.4 pending: remove Start's Hono catch-all and browser Ape dependency. Start
  HTTP routes must preserve external protocols and the explicit old-tab window.

The shared policy runner/service registry owns validation, auth, rate/config and
permission checks. Query and browser collections own remote data; local result
acknowledgements update those owners. No internal HTTP calls or dual writes.

## Validation and remaining adapters

Earlier implementation reported 50 passing Start/workerd tests; focused account
checks passed. Frontend full run had one commandline-owner timeout that passed
alone. These are historical observations, not a completed Stage 6 gate.

Rollback operation binding and Hono build remain production-only until cutover.
Retained old-tab HTTP adapters use the same services; retire only after the
[release window](release.md#compatibility-window): at least 30 days after last
legacy HTML, stale-tab acceptance, and seven days without supported legacy
mutation traffic. External protocols remain indefinitely.
