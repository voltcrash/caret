# macOS check after merge

The owner will run this check after PR #186 merges. It does not block merge.
Linux emulator CI covers the shared keyboard/text paths; macOS native CI covers
both CPU architectures and PTY lifecycle. This check adds actual Mac emulator,
font, function-key and input-method observations. No Windows check is required.

Use the merged checkout and pinned tools, or the matching native CI/release
candidate. Keep its `--version` output so the source revision is identifiable.
Repository commands below use fresh temporary profiles; select your preferred
Kitty-compatible emulator (Kitty, Ghostty or Alacritty).

```sh
vp run terminal:dev -- --version
vp run terminal:dev -- --config-dir /tmp/oxytype-mac-check/config --data-dir /tmp/oxytype-mac-check/data --mode custom --text 'one two'
```

- Type `one twx`, Backspace, then `o`. Result accuracy should be 87.5%; duration
  and WPM reflect your actual typing. F3 opens history; relaunch with the same
  profile and confirm persistence. F7 exports from history without overwriting.
- Run words, time, quote and zen (`--mode MODE`); F8 finishes, F5 starts new,
  F6 repeats. F2 edits settings, F4 opens custom text; paste is allowed there and
  blocked during typing. Use Fn with function keys if macOS reserves them.
  Ghostty may capture Ctrl+Enter for fullscreen; F8 remains the finish binding.
- F1 shows enhanced/basic negotiation. Repeat a held key and delete it. Releases
  need not be reported: auto requests disambiguation only and physical timing
  stays unavailable. `--keyboard basic` checks fallback; try Option/Alt+Backspace
  if Ctrl+Backspace is indistinguishable. The emulator's Option-as-Alt setting
  determines whether that combination reaches the app.
- Check combining text (`e` plus U+0301), CJK and emoji with your actual input
  method and font. Committed text should remain intact; Backspace removes one
  grapheme. Note preedit/complex-shaping limitations instead of inferring support.
- Resize below 60×18 and back; typing is blocked while small, clock continues.
  Check rapid input and scrollback. Quit normally and with Ctrl+C; verify shell
  echo/cursor remain usable. Ctrl+Z then shell `fg` checks suspend/resume.

Record macOS version, CPU, emulator/version, font, source revision, keyboard mode,
input method, exact cases performed and any failures in a new verification record.
Only after actual success, set `manualTerminals.macOS.status` to `pass` and its
`evidence` to that record in terminal-verification.json. `vp run terminal:release-gate`
then checks it alongside the publishing workflow's native/emulator/source jobs.
A failed case needs investigation; do not mark an unperformed case passed.

No account, deployment, release tag or publication is required for this check.
Delete the temporary config/data directories afterwards if no longer needed.
