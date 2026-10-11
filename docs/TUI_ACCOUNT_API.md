# TUI account and API integration

Stage F connects the terminal client to the Stage B backend and Stage C device
consent page. Run with Bun (`vp run dev-tui`); npm packaging remains Stage H.

## Connection settings

`network.json` lives beside `config.json` in the XDG config directory. It is
local to the terminal and is never uploaded as a web preference. All fields are
optional:

```json
{
  "apiUrl": "https://oxytype.voltcrash.com/api",
  "assetUrl": "https://oxytype.voltcrash.com",
  "timeoutMs": 10000
}
```

`OXYTYPE_API_URL`, `OXYTYPE_ASSET_URL` and `OXYTYPE_TIMEOUT_MS` override the file.
For local development:

```sh
OXYTYPE_API_URL=http://localhost:5005/api \
OXYTYPE_ASSET_URL=http://localhost:3000 vp run dev-tui
```

Base URLs accept HTTP(S), without embedded credentials, query or fragment.
Timeouts cover response bodies too. The contracts client validates responses,
uses the shared compatibility header and supplies Bearer auth to private
endpoints. Public endpoints and asset/device-code requests omit credentials.
Requests use no browser cookies/Origin, and do not follow redirects.

## Login and logout

Open account with Ctrl+A. Enter requests an `oxytype-tui` device code, shows
the verification URL and user code, starts the browser and polls at the server's
interval. Approve the matching code on `/device` while signed into the intended
account. Only the user code/link are rendered; device codes and access tokens
are not printed. If a browser cannot open, use the displayed link elsewhere.

Esc cancels pending login. Polling handles pending approval, slowdown, denial,
expiry and transient failures; late replies after cancellation cannot restore a
session. Successful login verifies the returned bearer session before storing
`credentials.json` in the XDG data directory. Atomic writes use mode `0600`;
existing credentials have permissions repaired and are bound to their API URL.

Account `r` checks/reconnects; `l` revokes the token and removes local
credentials. Failed revocation retains the credential for retry and displays
the failure. Expired/revoked sessions return to guest mode. A network failure
keeps the remembered account available for offline typing. Session checks and
queued uploads retry every 30 seconds, or immediately with `r`.

## Results and queue

Valid tests save locally and upload when `resultSaving` is enabled. Guest tests
stay local. The account/server identity is captured at the first input, so
later sign-in, logout or account changes cannot silently claim a test.

Online uploads set `client: "tui"`, `offline: false` and the authenticated UID
before hashing with the shared hasher. The result screen displays upload state,
server rejection messages and new TUI PBs. Web account history shows accepted
results under its TUI selector.

Before an online request, a durable fallback is written to `uploads.json`.
Failed requests and tests started offline upload later with `offline: true`
and a hash that includes that flag. These uploads affect history/typing stats,
with no PBs, XP, streak progression or leaderboard eligibility. Completion
timestamps survive delayed uploads.

The backend derives submission identity from the original payload without its
transport hash or `offline` flag. An online save retried as offline after a lost
response returns duplicate status 466 and cannot increment statistics twice.
Previously stored online/offline hashes are recognized for retained queues;
the transport hash still covers the complete submitted payload.

Draining is serialized, matches the original account and API server, and stops
on network/auth/rate-limit/server failures. Permanent rejections are retained
with their error instead of retried repeatedly. Backend duplicate responses
clear the pending entry. Queue writes must succeed before any submission.
Entries older than 30 days are removed when draining; local history is retained.
Quit flushes uploads, pending config sync and local writes before renderer cleanup.

## Config sync

Login and restored-session initialization pull the server config and replace
the local snapshot through shared defaults/migration. The server wins,
including when its saved config is empty. Failed pulls keep local settings and
disable pushes until reconciliation succeeds.

Validated local changes produce debounced PATCHes (500 ms), containing only
changed keys. Remote snapshots do not echo back. Edits made during an in-flight
PATCH remain pending; network failures retry for their original account.
Logout/account changes discard that account's pending sync work. A fresh login
or startup always resolves conflicts from the server.

Background pulls do not restart a running test. Its mode/word-count display and
core config stay on the test snapshot; updated settings apply to the next test.

## Assets

English 200 and English quotes remain bundled and work without network access.
Settings F2/F3 step through languages; a synced web language preference works
as well. Other languages and quotes download on first use from `assetUrl`.

Downloaded files are schema/name validated and atomically cached under
`cache/remote/<source-url-hash>/languages/` or `quotes/`. Cache envelopes carry
the site's `version.json` release plus ETag/Last-Modified validators. On a new
process, first use rechecks the release and conditionally fetches the asset;
304 preserves data, changed content replaces it, and network/download failures
use a valid cached copy. Sources cannot share another server's cache. Legacy
local cache files remain readable.

Uncached unavailable languages fall back to bundled English with a notice,
without changing the preference. Missing quote collections use English quotes
and preserve quote mode. A later reconnect can retry the original language.
The remaining display/browser approximations are in [MISSING.md](../tui/MISSING.md).

## Verification

- API tests use a real Bun HTTP listener, plus timeout/error/compatibility cases.
- Device tests cover polling/backoff, cancellation, permissions, server binding,
  expiry, offline checks and failed/successful revocation.
- Queue/config/asset tests cover cold recovery, identity isolation, hashing,
  30-day expiry, rejection handling, server conflicts, in-flight edits,
  conditional downloads, corrupt caches and offline quote fallback.
- OpenTUI screen tests drive consent keys, cancellation, PB feedback, reconnect
  and remote config changes during active typing.
- `backend/__tests__/d1/tui-client.spec.ts` runs the actual TUI client against
  ephemeral D1: real device claim/approval, session/token storage, public API,
  config pull/PATCH, recorded PTY telemetry, TUI history, delayed upload with
  unchanged PBs/XP, and rejection of the revoked token. Its nested tsconfig
  uses Bundler resolution for the imported terminal ESM sources.
- `python3 tui/scripts/smoke-account-pty.py` drives the actual CLI in four raw
  80x24 PTYs: login/browser launch, online PB, offline queue, cold reconnect,
  logout and cold offline French assets. HTTP/browser services are fixtures;
  the D1 test independently covers the backend. No real account is used.
- `python3 tui/scripts/smoke-pty.py` retains the Stage E offline CLI smoke.

Full repository checks: `vp run lint`, `vp run test`, `vp run build` and
`vp run format-check`. TUI rendering tests require Bun; the D1 test runs with
`vp test run __tests__/d1/tui-client.spec.ts` from `backend/`.

Verified: 114 TUI, 486 package, 721 backend unit, 99 D1 integration and 1,697
frontend tests. The initial combined test/typecheck run exceeded unrelated
test time limits; full frontend/backend reruns passed with `--maxWorkers=4`
and D1 with `--maxWorkers=1`.
