# Brand

## Mark

An I-beam text cursor with curled serifs, followed by a subscript 2. The cursor is where typing happens, and the subscript reads like O₂, the "oxy" in oxytype.

- Source of truth: `frontend/src/components/brand/oxytype-icon.ts` (one path on a 48-unit grid).
- The path is outlined from strokes in `frontend/scripts/outline-brand-mark.ts`. Edit the strokes there, then paste the output of `vp run outline-brand-mark` into `oxytype-icon.ts`.
- In UI: `<OxytypeMark class="fill-current text-main" />` from `frontend/src/components/brand/oxytype-mark.tsx`. It inherits `currentColor`, so themes recolor it.
- Wordmark: lowercase `oxytype` in Lexend Deca, `text` color, beside the mark.

Don't rotate, outline, stretch, or recolor the cursor and the 2 separately.

## Colors

Static assets use serika dark: mark `#e2b714` on `#323437`. The live favicon follows the active theme's `main` on `bg`.

## Assets

| File | Use |
| --- | --- |
| `frontend/static/images/favicon/oxytype.svg` | SVG favicon, standalone pages |
| `frontend/static/images/icons/oxytype-180.png` | Apple touch icon (full bleed) |
| `frontend/static/images/icons/oxytype-{192,512}.png` | Manifest `any` icons |
| `frontend/static/images/icons/oxytype-maskable-{192,512}.png` | Manifest `maskable` icons |
| `frontend/static/images/og/oxytype.png` | Open Graph / Twitter card, 1200×630 |

After changing the mark, regenerate all of them:

```sh
cd frontend && vp run generate-brand-icons
```
