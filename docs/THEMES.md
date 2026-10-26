# Adding themes

Follow [basic contributions](CONTRIBUTING_BASIC.md) to fork and open a pull request.

1. Pick a lowercase theme name using letters, digits and underscores.
2. Add it to `ThemeNameSchema` in `packages/schemas/src/themes.ts`.
3. Add a matching entry to `themes` in `frontend/src/ts/constants/themes.ts`.
   Copy an existing entry and set all ten hex colors: `bg`, `caret`, `main`, `sub`,
   `subAlt`, `text`, `error`, `errorExtra`, `colorfulError` and `colorfulErrorExtra`.
4. For custom CSS, add `frontend/static/themes/<name>.css` and set `hasCss: true`
   in the constants entry. Omit both when custom CSS is unnecessary.

Check [theme guidelines](CONTRIBUTING.md#theme-guidelines) and include screenshots
with flip test colors and colorful mode enabled and disabled.
For local validation, follow [development setup](CONTRIBUTING_ADVANCED.md), then
run from the repository root:

```sh
vp run --filter @caret/frontend check-assets themes
```
