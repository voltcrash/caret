# Oxytype offline terminal

First native release: Linux/macOS offline typing and local history, using the same
Rust engine as the website. No account login, cloud sync, telemetry or first-run download.

Download the matching `oxytype-vVERSION-TARGET` archive from the repository's
GitHub Releases when a maintainer publishes one. Verify its SHA-256 against
`SHA256SUMS`, extract, and put `oxytype` on PATH.
Users need no Rust, Node, vp, source checkout or network access. Keep LICENSE,
attribution and third-party notices with redistributed copies.

```sh
oxytype --help
oxytype --mode words --words 25
oxytype --mode time --time 60 --punctuation --numbers
oxytype --mode quote --quote-length 0,1
oxytype --text 'Your private practice text.'
oxytype --file practice.txt --custom-order shuffle --custom-limit word --custom-length 50
oxytype --mode zen
oxytype --paths
oxytype --diagnostics
oxytype --export history.json
```

Binary invocation above is for installed users. Repository development commands:

```sh
vp run terminal:dev
vp run terminal:test
vp run terminal:test:pty
vp run terminal:test:emulator -- --emulator kitty --command /usr/bin/kitty
vp run terminal:build
vp run terminal:package
vp run engine:lint
vp run engine:fmt
```

Use F1 for help. F5 starts a new test; F6 repeats the native wordset; F8 finishes
manually. F2 edits settings when inactive; arrows select/change, Enter validates
and applies. F4 opens private custom text setup (paste allowed there). F3 browses
history: arrows select, Enter details, m filters, PgUp/PgDn pages, F7 exports the
filter, F8 opens a recorded compatible replay. Replay: Right/Space step, Home
restart, PgUp/PgDn seek by word. Ctrl+Q/C or F10 quit. Unix Ctrl+Z suspends the
foreground job; resume with the shell. Native elapsed time continues while
suspended or too small. Typing is disabled below 60×18; resizing does not pause.

Input maps characters, Backspace, Ctrl/Alt+Backspace word deletion, Enter and Tab.
Ctrl+Backspace can be indistinguishable from Backspace in basic mode; use
Alt+Backspace when the terminal reports that combination. Kitty keyboard reporting
is queried before reading events; fallback is basic. Kitty, Ghostty, Alacritty and
other implementations use the same negotiated protocol, without a terminal-brand
allowlist or reliance on TERM naming. Graphics/image support is independent: this
app renders text and does not require or send Kitty graphics commands. Protocol
reference: [Kitty keyboard](https://sw.kovidgoyal.net/kitty/keyboard-protocol/).

`--keyboard basic` skips queries for troublesome terminals/multiplexers. Modified
Enter may be indistinguishable in basic mode or intercepted by emulator bindings
(e.g. Ghostty fullscreen); use F8 to finish. Repeat
deliveries type once each; release events never type. Bracketed paste is blocked
during tests. Terminals that send unmarked paste cannot be distinguished from
typing. IME committed text works when delivered as ordinary characters; terminal
preedit/composition lifecycle and physical key identity are unavailable.

The renderer keeps UTF-16 engine offsets separate from grapheme clusters and
terminal columns. It handles combining marks, CJK, emoji, tabs/newlines and wraps;
font/emulator Unicode width versions can differ. RTL ordering, Arabic/Indic
shaping, emoji appearance and terminal IME behavior are not browser-equivalent
guarantees. See the tested matrix below. Generated isolated surrogates are rejected
as untypable rather than replaced. Underline plus `!` indicates errors without
relying on color. Terminal/default, light and high-contrast themes are available;
reduced animation lowers active redraw frequency.

Physical-key timing remains unavailable even if releases are reported. History
stores null for absent measurements. WPM, accuracy, duration and validity come
from native core with actual committed text and monotonic delivery timestamps.
Short/failed/repeated results remain in history with their native invalid reason.

[Content packs and supported rules](terminal-content.md) document offline assets,
CLI settings and explicit unavailable hooks. [Local storage](terminal-storage.md)
documents paths, format, concurrency, privacy and export. Replay recording is an
explicit opt-in in settings or `--record-replay`; it stores private target text and
input. The header warns while enabled. Default summaries contain neither. Saved
custom mode requires private text again; use `--text`, `--file`, or launch with
`--mode words` and open F4. Packs must be supplied again with `--pack`.

Failed result writes stay queued in memory with an UNSAVED indicator; F9 retries.
Quitting with pending results reports the loss and leaves prior history intact.
Malformed/future data is preserved with a clear error. No automatic deletion or
silent reset. Export never replaces an existing path. For uninstall, remove the
binary; optionally remove the config/data directories printed by `--paths` after
closing all instances. Copy whole closed databases/directories when backing up.

Cleanup covers normal exit, errors, panic and supported signals (Unix HUP/TERM/INT,
suspend/resume). SIGKILL, power loss and forced process termination cannot run
cleanup; use the shell's terminal reset command if needed. SQLite transactions
protect prior committed data; a result not yet committed can be lost.

## Verification matrix

| Environment | Evidence | Status |
| --- | --- | --- |
| Linux ARM64, POSIX PTY/basic protocol | Five modes, settings/editor, history/export/replay, resize, cleanup, SIGTERM, suspend/resume | Pass |
| Linux ARM64, simulated enhanced protocol in PTY | Negotiation, press/repeat/release, owned flag cleanup | Pass; protocol simulation |
| Linux x86_64/ARM64 and macOS Intel/Apple Silicon CI PTYs | Native input/editing/history; POSIX lifecycle, resize, suspend/resume, extracted release input | Pass; automated PTY |
| Ratatui TestBackend | Combining/CJK/emoji/tab/newline/cell wrapping/caret/UTF-16 deletion | Pass; simulated display |
| Physical Linux input/IME | Hardware/IME, font appearance and scrollback | Unperformed; not a merge requirement |
| Real macOS terminal | Hardware/IME, font appearance, resize, suspend | Owner will check after merge |

Build/smoke archive verification is recorded separately in terminal-release.md.
Real Linux emulator tests run actual Kitty/Ghostty/Alacritty processes with
XTest input in private Xvfb displays. They exercise key encoding, combining/CJK/
emoji UTF-16/grapheme deletion, repeats/releases, resize/input blocking, native
scores, history/replay/editor and actual keyboard-stack/raw-mode cleanup. They
are automated emulator checks; hardware IME and visual font inspection remain
unperformed. Exact versions/results are recorded in progress.md.

`terminal:test:emulator` requires Linux Xvfb, xdotool, libX11 and the selected
emulator. It creates its own display, fresh emulator configuration and app profile;
it never targets the user's desktop windows. `--emulator` accepts kitty, alacritty
or ghostty; `--command` names the installed executable. `--evidence DIR` retains
version/capability JSON and private test input/output traces. Distribution Kitty
and Alacritty are checked in native CI; local checks also cover Ghostty.

Compatibility depends on the implemented text/keyboard protocol, terminal version
and configuration. Do not infer certification of every version/fork from graphics
support alone. Basic text fallback and unavailable observations remain explicit.
