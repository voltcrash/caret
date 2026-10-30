# Font optimization evidence and merge gate

**The original acceptance contract is BLOCKED.** Exact-cmap core/extended
splitting changed rendering in the real production fixture. The retained
full-face candidate is a reviewable partial result, not completion of the
split/core-preload requirement. Parent owns the scope decision, CI monitoring
and merge. No production/deploy changes were made.

## Retained result

- Text files: **4,417,824 → 3,339,780 bytes**, saving **1,078,044 (24.40%)**.
- Settings and command previews: **4,619,400 → 3,541,436 downloaded font-body
  bytes**, saving **1,077,964**. These totals include the unchanged icon fonts.
- Default typing: **317,940 → 317,940** font-body bytes. Roboto Mono and Lexend
  Deca remain exact originals; no default-route speedup is claimed.
- **62/62 before/after screenshots: zero changed pixels, maximum delta 0.**
  Repeated untouched baseline: **62/62, zero changed pixels** too.
- 35 text files shrink. Six selectable/fallback faces remain original when
  reserialization changes pixels or offers no saving. ASL Gallaudet remains
  original separately; no modification grant was found. Font Awesome remains
  complete and byte-identical.

[Exact per-font and route tables](TABLES.md),
[machine-readable measurements/adjudications](measurements.json),
[original inventory](baseline-inventory.json),
[candidate inventory](after-inventory.json),
[glyph/metric/hint/notice validation](validation.json).

No CSS, registry, runtime, fallback, preload, loading-gate, standalone, Storybook
plugin or service-worker source changes remain. The production app CSS is still
`app-BHEmxno4.css` (230,150 bytes). Public family names, all weight/style
descriptors, `swap`/`block` contexts, custom uploads and static warnings stay
unchanged. The existing CSS assembly serves committed full WOFF2 files; it
does not process them.

## Baseline and method

Baseline: `7699fef5239c2082baa1ef1b2be8014ff3d02714`, `origin/main`.
Initial branch: `voltcrash/subset-web-fonts-1`. Initial worktree: only the
authorized untracked `docs/font-optimization-prompt.md`.

Production build: `vp exec node frontend/scripts/ci-build.ts`.
Browser: Chromium **156.0.8078.4**, Playwright **1.64.1**, Linux arm64,
1440×1000 viewport, DPR 1, en-US, UTC. Node 26.13.0, Python 3.14.8,
FontTools 4.61.1, Brotli 1.2.0, Pillow 12.1.0. Actual app cases use serika dark;
isolated specimens use #202020/#ddd, and isolated network cases use browser
default colors. Seeds include a fixed crypto RNG, not just `Math.random`.
Result/command animations use controlled clocks. CSS animations are disabled
for screenshots and native input carets hidden; no text masks or tolerance.

The original production build was preserved **before changing fonts** at
`/tmp/caret-font-baseline-start`. Additional language/variation captures used
that same preserved build. Candidate routes used a fresh production build.
No before image was generated from candidate fonts. Font specimens use the
corresponding built CSS; experimental asset interception applies to isolated
specimens only. The rejected split route images came from the temporarily
integrated and built split implementation, subsequently reverted.

The local system initially lacked CJK coverage. A separate, unshipped,
checksummed Noto Sans CJK SC font was added through a temporary fontconfig file
for **both** phases. CDP confirms CJK uses `Noto Sans CJK SC` as a system face.
Prepare it with `vp exec python3 scripts/fonts/system-fixture.py` and set
`FONTCONFIG_FILE=/tmp/caret-font-system/fonts.conf` for every capture.
[Source/checksum](system-font.json). No OS font was installed globally.

Coverage: actual default/code/accented typing; Arabic/Persian, Thai, Lao and CJK;
explicit Boon/Noto Lao/Noto Naskh selections; settings and command previews;
public/about/privacy/404; pending typing initialization; completed result canvas.
Every applicable text face has a specimen at 8, 9, 11, 12, 16, 24, 32, 64px,
including light/medium/semibold, synthetic bold/italic and bold inside italic.
Combining sequences, punctuation, ligatures, mixed-script fallback and kerning
boundaries are included. Adwaita/Iosevka additionally exercise `0 + U+FE00`.
`TypingLoader` currently has no callers; its font override was audited, not
invented as an actual route state. `hyphens: auto` and explicit axis/feature
settings were not found. [Caller/content audit](usage-audit.json).

The validator reopens fonts, checks every original cmap mapping, both Unicode
variation sequences, exact outlines/metrics/instructions, unencoded layout
closure and missing-glyph geometry, global hints, axis ranges and notices.
Incorrect source glyph bounding boxes must remain unchanged: recalculating
them moves glyphs. Static faces remain static; Cascadia's wght 200–700 remains.
No originally supported script/Latin-1/Extended-A mapping is discarded.

## Rejected alternatives and exact retained costs

Every nonzero comparison is classified as a rendering regression and the
alternative is disabled. There are no "small enough" dismissals. Full per-case
counts, dimensions, deltas and decisions are in measurements.json; experiment
manifests record actual bytes and hashes. Missing cases in specimen-only
experiments are explicitly not run, not passes.

1. **Strict split:** 43 of 57 captured cases differ; 5,071,571 changed pixels
   including padded full-frame comparisons when dimensions change.
   Accented typing changes 3,991 pixels; unsupported Thai changes 7,742.
   CDP shows the original blank missing glyph from Roboto Mono replaced by
   system Adwaita Mono tofu when exact unicode ranges exclude the character.
   Combining-mark placement changes too. Fallback order was not changed.
   Preloaded text bytes would fall 63,520 → 15,932 (47,588 saved), but this
   rendering change is not authorized. Full split files total 3,624,592 bytes,
   larger than the retained candidate because of duplicated closure/metadata.
   [Before](before/accents.png), [rejected](rejected-split/accents.png),
   [diff](before-vs-rejected-split/accents.png),
   [all results](before-vs-rejected-split/summary.json).
2. **Hint removal:** 44 of 45 specimen/isolation cases differ, 7,453,558 changed
   pixels. Alternative files total 2,519,364 bytes: **820,416 bytes withheld**
   relative to the retained files. Some reserialized originals/CommitMono are
   confounded by their independently rejected reserialization; this is an exact
   alternative-file delta, not a claim of isolated compressed-table attribution.
   [Results](before-vs-trial-nohint/summary.json).
3. **Default layout removal:** 40 of 45 cases differ, 13,024,211 pixels.
   Alternative 2,532,380 bytes: **807,400 bytes withheld**. Shaping, marks,
   composition, contextual alternates and kerning stay.
   [Results](before-vs-trial-no-layout/summary.json).
4. **CommitMono:** trimmed reserialization (31,852 bytes) and even all-features
   reserialization (38,024 bytes) both change 232,167 pixels and page dimensions.
   Keep its exact 39,992-byte source: **8,140 / 1,968 bytes withheld** respectively.
   Do not attribute this solely to discretionary features; the all-features
   control also fails. [Control](before-vs-trial-commit-keep/summary.json).
5. **Cascadia 400-only instance:** 114,064 versus retained 186,908 bytes;
   **72,844 bytes withheld**. Its Chromium specimen has zero differences, but
   callers request other CSS weights and other browsers' matching/synthesis is
   unproven. Retain the original variable range conservatively.
6. **Unicode variation sequences:** subsetting initially dropped U+FE00 entries
   from Adwaita/Iosevka. The final generator preserves and validates them; tests
   and dedicated original/candidate screenshots cover both. Relative to the
   preceding full-face files, Adwaita costs +292 bytes and Iosevka −60 bytes
   (compression interactions), **+232 bytes net**. The historical rejected split
   predates this fix and is not a valid full-coverage candidate either. Current
   `--split` reruns retain UVS; their exact two-font bytes therefore differ from
   the archived rejected-split inventory. Its documented route failures do not
   involve those two fonts.

The strict split/core-preload gate cannot pass with the measured candidate.
No unsplit interception face, invented Unicode range, changed fallback stack,
idle precache or CSS embedding was added to disguise that failure.

## Rerun

See [manual font workflow](../FONTS.md). From root:

```sh
vp exec /tmp/caret-font-tools/bin/python scripts/fonts/generate.py --check
vp exec /tmp/caret-font-tools/bin/python scripts/fonts/validate.py
vp exec python3 scripts/fonts/system-fixture.py
vp exec node frontend/scripts/ci-build.ts
# From frontend (preserve a true original build for before/repeat):
vp exec env FONTCONFIG_FILE=/tmp/caret-font-system/fonts.conf FONT_PROOF=after vp exec playwright test font-proof.spec.ts --config=playwright.start.config.ts --project=start
# Back at root:
vp exec /tmp/caret-font-tools/bin/python scripts/fonts/compare.py before after
vp exec /tmp/caret-font-tools/bin/python scripts/fonts/compare.py before repeat
vp exec /tmp/caret-font-tools/bin/python scripts/fonts/report.py
```

Comparison requires nonempty, identical PNG case sets and exits nonzero for any changed or incomplete proof. Each comparison saves
real diff PNGs; different dimensions are padded, never cropped or masked.
Experimental generator commands/hashes: `experiments/*.json`. For a targeted
specimen-only experiment, first copy its matching original baseline PNGs into
an explicitly named temporary baseline directory, then compare those two equal
sets. Historical experiment summaries retain their explicit not-run rows; do
not pass a partial set to the strict comparator or count those rows as passes. Use
`FONT_PROOF_ASSETS=<output-directory>` plus `--grep='all font'` for specimens.
`FONT_PROOF_VARIATIONS_ONLY=1` captures the added UVS cases from an archived
baseline without replacing the existing specimens. Preserve the same tool,
browser, OS/fallback, content, viewport and clock configuration.

## Checks and limitations

Observed passing: deterministic binary generation; reopened font validation;
font checksum/coverage/UVS, plugin and runtime tests; full asset validation;
production build; type-aware frontend lint/typecheck; styles; six workerd
document checks; 18 manual proof tests; 13 startup/offline browser checks.
Full frontend CI test attempt: 197 files / 2,095 tests passed before the
unchanged production-build test failed (`fails closed when vp cannot start`,
expected exit 1, received 127). Vitest then closed its browser connection while
bailing. The original-font control and follow-up results are recorded in
checks.json; no production/deploy script changes are authorized or included.
The same one-test failure reproduces with exact original fonts restored.
All remaining frontend tests pass: **256 files, 2,254 tests**, using the explicit
exclusion recorded in checks.json. This is not a claim that the full suite is
green. Formatting passes. Sol review is recorded in REVIEW.md.

Storybook build fails with `Missing "#tanstack-start-entry" specifier in
"@tanstack/start-server-core" package`. Repeating the same build with all exact
original font bytes restored reproduces the failure; optimized bytes were
restored afterward. Its plugin/URL generation tests pass and all 42 static font copies match; no Storybook runtime
or dependency fix is included. Logs were retained locally under
`/tmp/caret-font-storybook-{baseline,optimized}.log`.

Only the recorded Chromium/Linux environment has direct pixel proof. Other
browsers/OSes and an actual local-font upload were not browser-tested; existing
font runtime tests cover uploaded/preferred-font logic, which is unchanged.
Required remote CI/review states are pending PR creation. Even green CI does
not remove the unresolved original split/core-preload acceptance gate.

Comparator fail-closed checks: six manual CLI tests pass; four fail against the pre-S1 comparator. Both complete 62-image comparisons were rerun after S1.
