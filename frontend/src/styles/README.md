# Styling

- `app/app.css`: Start document and Storybook entry.
- `theme.css`: Tailwind palette, breakpoints, reusable utilities. `layers.css`: shared cascade order.
- Defaults and compatibility hooks use `@apply`; component classes override them in the utilities layer.
- Tailwind's Vite plugin handles vendor prefixing; do not add a separate Autoprefixer pass.
- Normalize.css runs in the first cascade layer; Tailwind Preflight overrides shared defaults in `base`. Normalize still supplies native-control rules, including textarea overflow and WebKit file-upload button styling. Removing it is a cross-browser CSS change, not part of retiring Slim Select.
- Keep word/letter, caret, theme and funbox selectors stable. Imperative typing nodes need selector-based state styles.
- Keep animation names stable: runtime styles and external theme/funbox CSS reference them. Keyframes require ordinary CSS declarations.
- `font-styles.ts` generates ignored CSS from font metadata and official Font Awesome CSS. Start and Storybook register the same plugin. `app/app.css` imports `oxytype-fonts.css`; `vendor.css` imports `oxytype-fontawesome.css`.
- Standalone routes (OAuth callback, privacy policy, 404) retain their original grid dimensions and native auth inputs.

Checks: `vp run lint-styles`, frontend build/tests, `vp lint --type-aware --type-check --format agent frontend`.
