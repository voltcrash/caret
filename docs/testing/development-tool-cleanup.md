# Development tool cleanup

Date: 2026-10-25. Base: `bfbc3c1cb01aa516ce747d81db0714ee2e8abf5c`.

## Usage check

- `@storybook/addon-vitest` supplied a separate browser test project. No story
  interaction or lifecycle test hooks were found. CI did not run this project.
  The accessibility test setting was `todo`, which did not fail CI.
- `concurrently` was used only by the frontend `dev-test` command.
- `@sentry/vite-plugin` is imported by the Vite config. Builds enable it when
  a Sentry DSN is set. Release and source map uploads still need this plugin,
  so it moves from application dependencies to development dependencies.

## Changes

- Remove the Storybook test add-on and its separate Vitest project. Remove
  Storybook's direct Vitest, coverage, browser provider, and Playwright packages.
  Frontend browser tests keep their own packages and configuration.
- Keep Storybook stories, docs, the accessibility panel, themes, viewports,
  action spies, and its browser `process.env` definition.
- Remove `concurrently` and `dev-test`. Document separate app and test watch
  terminals in [development setup](../CONTRIBUTING_ADVANCED.md).
- Keep Sentry browser error reporting and build integration. The build plugin
  remains pinned to 5.4.0 under `devDependencies`.

This removes six direct dependency entries and eight package versions from the
lockfile, including an old Vitest 4 runner. No package versions were added.

## Validation

- Both frontend shards pass: 1,041 and 1,129 cases, 2,170 total in 244 files.
  One initial shard run timed out during concurrent builds. The targeted file
  and whole shard passed after the builds completed.
- Frontend lint, type checks, and Knip pass.
- The app build passes with a public fixture Sentry DSN and an empty auth token.
  This enables the build plugin without creating a release or uploading maps.
- Package checks confirm the removals, Sentry's dependency placement, and the
  retained Storybook docs/accessibility add-ons.
- Formatting and whitespace checks pass.

The Storybook static build is blocked on both the unchanged base and this branch:
`Missing "#tanstack-start-entry" specifier in "@tanstack/start-server-core" package`.
Its existing TanStack Start import problem needs a separate fix before preview
rendering can be checked with a complete static build.
