# Adding layouts

Follow [basic contributions](CONTRIBUTING_BASIC.md) to fork and open a pull request.

1. Copy a similar layout into `frontend/static/layouts/<name>.json`.
2. Set `type` to `ansi` or `iso`, and `keymapShowTopRow` to control whether the
   number row is always visible.
3. Define `keys.row1` through `keys.row5`. Each key is an array of one to four
   single-character legends, ordered as unshifted, shifted, AltGr and shifted
   AltGr. For example, `["e", "E", "€"]` represents three legends. Escape
   quote/backslash characters in JSON.
4. Add the filename without `.json` to `LayoutNameSchema` in
   `packages/schemas/src/layouts.ts`.

Required row sizes:

| Type | Row 1 | Row 2 | Row 3 | Row 4 | Row 5 |
| --- | --- | --- | --- | --- | --- |
| ANSI | 13 | 13 | 11 | 10 | 1–2 |
| ISO | 13 | 12 | 12 | 11 | 1–2 |

Follow [layout guidelines](CONTRIBUTING.md#layout-guidelines). For local validation,
follow [development setup](CONTRIBUTING_ADVANCED.md), then run from the repository root:

```sh
vp run --filter @oxytype/frontend check-assets layouts json
```
