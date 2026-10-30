# Caret font optimization brief

Optimize Caret's shipped web fonts for the smallest **visually identical**
downloads. Implement, measure, prove, and open a PR. Rendering preservation wins
over byte savings. Never silently accept a visual regression.

## Project context

- SolidJS + TanStack Start, Tailwind CSS, Cloudflare Worker. Follow `AGENTS.md`.
  Use `vp` for commands; typecheck with
  `vp lint --type-aware --type-check --format agent`, never `tsc`.
- Sources: `frontend/static/webfonts/`; registry:
  `frontend/src/ts/constants/fonts.ts`; names:
  `packages/schemas/src/fonts.ts`. Inventory every shipped file, including
  unregistered ones; do not assume every font is variable.
- `frontend/vite-plugins/font-styles.ts` generates ignored CSS for Start and
  Storybook, including both normal and ` Preview` families and Font Awesome.
  It currently declares normal faces at registry weights with `font-display: swap`.
- `frontend/src/routes/__root.tsx` preloads Roboto Mono and Lexend Deca globally.
  `frontend/src/styles/standalone-theme.css` declares these with
  `font-display: block`. Preserve both contexts' existing display behavior.
- `frontend/src/styles/core.css` supplies the default stack. Preserve
  `frontend/src/app/fonts.client.ts`, `font-runtime.client.tsx`, language
  `preferredFont` selection, uploaded LOCALCUSTOM fonts, system/custom families,
  and fallback ordering. Do not subset a user's uploaded font.
- Inspect inline styles and Tailwind arbitrary properties as well as CSS:
  `Logo.tsx`, `StandaloneHeader.tsx`, `TypingLoader.tsx`, settings'
  `custom-setting/FontFamily.tsx`, command palette `Commandline.tsx`,
  `ChartJs.tsx`, typing/result chart modules, and all other callers. Font previews
  must continue working. Keep Font Awesome icon coverage and `Fa` intact.
- Content includes `frontend/static/languages/`, quotes, code dictionaries,
  layouts, UI strings, usernames, and arbitrary custom typing text. This is a
  multilingual typing app, not a static Latin blog. Audit combining marks,
  shaping, RTL, Thai/Lao/Arabic and Persian, Greek/Cyrillic, and CJK fallback.
- Read `docs/FONTS.md`, contribution/font licensing guidelines,
  `frontend/scripts/check-assets.ts`, and `frontend/src/styles/README.md`.

## Measure before changing

Record baseline commit and clean/dirty state. Before modifying fonts, save a
machine-readable inventory and readable report: path, exact bytes, SHA-256,
glyph/cmap counts, Unicode coverage, axes and ranges/defaults, GSUB/GPOS feature
tags, hinting tables/instructions, names, license and Reserved Font Names.
Include text and icon fonts, with system fonts explicitly marked as unshipped.

For representative actual routes/states, record cold-cache font requests,
per-file response bytes, total font bytes, font preload URLs, and which faces
render which content. Distinguish transfer bytes, decoded body bytes, and
on-disk bytes; do not count every file in CSS as downloaded. Include default
typing, code typing, accented text, settings previews, standalone/public pages,
and multilingual states. Discover real routes from `frontend/src/routes`.

Audit actual characters, family/weight/style/axis values, one-off overrides,
bold inside italics, synthetic bold/italic, and enabled/default-required
OpenType features, across CSS, TSX, runtime code, canvas, and content. Check
`hyphens: auto` and U+2010, soft hyphens, nonbreaking spaces, curly quotes,
dashes, ellipsis, combining sequences, and shaping dependencies. Report absence
instead of inventing usage.

## Optimization and invariants

1. Write a deterministic **manual** font-processing script, with pinned tool
   versions, original source provenance/checksums, licensing, exact command and
   repeatability checks. Commit generated WOFF2 and metadata. No font processing
   in install/build/dev/CI hooks. Existing Vite CSS assembly may consume committed
   metadata; it must not run font tools. Never subset an already-subset output.
2. Keep used characters plus all originally supported Latin-1 and Latin
   Extended-A. Preserve multilingual support and existing custom-text coverage:
   static content alone cannot prove a shipped glyph unused. Retain extra
   coverage in the lazy extended file where needed; quantify that cost. Do not
   add CJK glyphs to fonts that currently rely on system fallback, or remove
   existing supported scripts to force new fallback.
3. Narrow variable axes only to proven effective ranges, respecting current
   face descriptors and overrides. Fix an axis only when no caller overrides
   it. Do not introduce different weight matching, optical sizing or synthetic
   rendering. Leave static faces static.
4. Remove only features proven unused; preserve default shaping, kerning,
   composition, mark positioning and necessary layout closure. Attempt hint
   removal, measure its savings separately, and retain hinting whenever removing
   it changes pixels. Do not trade identical rendering for smaller files.
5. Split each applicable text face into disjoint core and extended WOFF2 files.
   Core: supported ASCII plus common curly quotes, dashes, ellipsis and punctuation
   justified by measurements. Extended: remaining supported retained characters.
   Unicode ranges must exactly match each output's actual cmap; no invented
   coverage. Validate outputs after reopening them, including subsetting-tool
   quirks, retained layout/variation tables, names, metrics and glyph outlines.
   Required shaping glyphs need not have Unicode mappings. Handle fonts with no
   useful core or empty extended set explicitly; don't invent invalid files.
6. Preserve public CSS family names/settings identifiers; rename all necessary
   internal names when an OFL Reserved Font Name requires it. Preserve notices.
7. Preload only core replacements for the fonts already preloaded (Roboto Mono,
   Lexend Deca), with matching URLs and existing attributes. Do not preload every
   selectable family or extended files. Keep preview faces aligned with regular
   split faces. No unsplit/generated fallback face may intercept extended
   characters. Check Start, standalone styles, Storybook, cache/versioned asset
   delivery and existing service-worker behavior. Do not add idle precaching or
   embed fonts into CSS; those are future experiments.
8. Preserve `font-display`, all fallback stacks, CSS metrics, normal/italic and
   weight declarations, loading gates, app owners/lifecycles, and static
   `noscript`/`#nocss` warnings. Avoid unrelated UI/content changes.

## Proof required before shipping

Build a true before/after comparison from the same content and fixture seed,
browser/version, OS, viewport, DPR, theme, locale, config, time and font state.
Use the production Start fixture (`frontend/playwright.start.config.ts`,
`frontend/scripts/ci-build.ts`, `serve-start-fixture.ts`, `start-e2e/fixtures.ts`),
plus existing typing fixtures where useful. Preserve the baseline before font
changes; do not regenerate it from optimized files. Use Playwright screenshots
and pixel diffs; browser UI tools only where allowed by current instructions.

Cover actual pages/states with default text, code/ligatures, italics and nested
bold, accented Latin and combining marks, inline font overrides/logo/loader,
settings and command palette previews, selected nondefault fonts, result canvas
charts, Arabic/Persian, Thai/Lao and CJK. Also compare all changed fonts in a
deterministic specimen across the site's actual sizes/weights/styles, including
small UI text. Compare repeat baseline captures to identify test instability.
Wait for real requested fonts; distinguish transient loading from settled pixels.

Save before, after and diff PNGs and a machine-readable summary: dimensions,
changed-pixel counts and percentages, maximum channel delta, case configuration,
baseline revision and tool versions. Zero unexpected changed pixels is the
default gate. Never hide changed text under masks or a permissive threshold.
Explain every nonzero result with evidence: content mismatch (rerun), rendering
regression (fix/revert), or demonstrated subpixel/environment instability. Do not
declare differences harmless merely because small. If a useful optimization
changes rendering, leave it off and report exact savings and affected rendering
for a later explicit approval.

Repeat cold-cache network measurements after optimization. Prove extended files
are absent for genuinely core-only content and loaded for a character unique to
extended coverage; account for non-ASCII font-preview labels and multilingual
pages. Check preload reuse/no duplicate full-font requests, actual fallback
rendering, and unchanged loading behavior. Verify manual generation is repeatable.

Run targeted font plugin/runtime tests, asset validation, relevant SSR/browser
checks, formatter, styles and type-aware lint according to repository CI. Add
focused checks for exact/disjoint Unicode ranges, preview/fallback precedence,
preload URLs and deterministic outputs where they catch real failures. Do not
add brittle implementation-mirroring tests or automatic font processing.

## Deliverables and workflow

- Commit this brief, baseline/after inventories and compact evidence, manual
  generator, committed fonts/metadata, runtime CSS/preload integration, focused
  regression coverage, and updated `docs/FONTS.md` with rerun triggers.
- Report exact before/after bytes per original font (core, extended, total and
  savings), per route/state with preload lists, visual results and artifact
  locations, retained hinting/features/coverage costs, deviations and limitations.
  Include manual rerun command and when changes to source fonts, text/Unicode,
  font settings/features/axes or dependencies require rerunning/revalidation.
- Use many small, coherent, independently reviewable commits: measurement,
  generator, output groups, integration, visual/network proof, docs, real fixes.
  Do not manufacture empty commits or deliberately broken intermediate states.
- Use `full-send`: proof, `sol-loop` review, `file-pr`, required CI/review fixes,
  then merge only after the merge gate passes. Delegated implementers hand PR
  ownership back to the parent for watching/merge; never watch from a child.
- CSS embedding of core fonts and idle precaching of extended fonts are future
  work; do not implement in this PR.
