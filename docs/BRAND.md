# Brand

## Mark

An I-beam text cursor with curled serifs: the spot where typing happens.

- Source of truth: `frontend/src/components/brand/caret-icon.ts` (one path on a 48-unit grid).
- The path is outlined from strokes in `frontend/scripts/outline-brand-mark.ts`. Edit the strokes there, then paste the output of `vp run outline-brand-mark` into `caret-icon.ts`.
- In UI: `<CaretMark class="fill-current text-main" />` from `frontend/src/components/brand/caret-mark.tsx`. It is cropped to its ink, so size it by height (`h-6`). It inherits `currentColor`, so themes recolor it.
- Wordmark: lowercase `caret` in Lexend Deca, `text` color, beside the mark.

Don't rotate, outline, stretch, or recolor parts of the mark separately.

## Colors

Static assets use serika dark: mark `#e2b714` on `#323437`. The live favicon follows the active theme's `main` on `bg`.

## Assets

| File | Use |
| --- | --- |
| `frontend/static/images/favicon/caret.svg` | SVG favicon, standalone pages |
| `frontend/static/images/icons/caret-180.png` | Apple touch icon (full bleed) |
| `frontend/static/images/icons/caret-{192,512}.png` | Manifest `any` icons |
| `frontend/static/images/icons/caret-maskable-{192,512}.png` | Manifest `maskable` icons |
| `frontend/static/images/og/caret.png` | Open Graph / Twitter card, 1200×630 |

After changing the mark, regenerate all of them:

```sh
cd frontend && vp run generate-brand-icons
```
