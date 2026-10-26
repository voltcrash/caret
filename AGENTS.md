Be extremely concise. Sacrifice grammar for concision.
Frontend UI uses SolidJS `.tsx` components. Keep imperative DOM work inside component-owned refs/lifecycles. Allowed imperative work: document/head updates, canvas and screenshots, word/letter rendering and caret positioning. Preserve static `noscript`/`#nocss` fallbacks in `frontend/src/html/warnings.html`.
App is TanStack Start: routes in `frontend/src/routes`, server-only code in `*.server.*`/`@caret/backend` subpaths, browser-only modules `*.client.*`. Navigation via Router/`app/navigate.ts`. App state via `createAppSignal`/app owners, never module-level mutable state.
Use `vp` for all commands; pnpm is the PM under the hood.
Single test file: `vp test run path/to/test.ts`
When running oxc lint, always use `--format agent`.
For typechecking, use `vp lint --type-aware --type-check` instead of `tsc`.
For styling, use Tailwind CSS, class property, `cn` utility. Do not use classlist. Only colors available are those defined in Tailwind config.
Use the `Fa` component for icons.
In plan mode, before writing up a plan, ask clarifying questions if needed. At the end of plan mode, give me a list of unresolved questions to answer, if any. Make them concise.
