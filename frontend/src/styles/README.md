# Styling

- `app/app.css`: Start document and Storybook entry.
- `theme.css`: Tailwind palette, breakpoints, reusable utilities. `layers.css`: shared cascade order.
- Defaults and compatibility hooks use `@apply`; component classes override them in the utilities layer.
- Tailwind's Vite plugin handles vendor prefixing; do not add a separate Autoprefixer pass.
- Keep Normalize.css: Slim Select search inputs retain its native appearance and focus-outline offset, which differ from Preflight alone.
- Keep word/letter, caret, theme and funbox selectors stable. Imperative typing nodes need selector-based state styles.
- Keep animation names stable: runtime styles and external theme/funbox CSS reference them. Keyframes require ordinary CSS declarations.
- `font-styles.ts` generates ignored CSS from font metadata and official Font Awesome CSS. Start and Storybook register the same plugin.
- Standalone routes (OAuth callback, privacy policy, 404) retain their original grid dimensions and native auth inputs.

Checks: `vp run lint-styles`, frontend build/tests, `vp lint --type-aware --type-check --format agent frontend`.
