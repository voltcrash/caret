# Advanced development setup

Use Git, Node 24.21.0 and Vite+ (`vp`); pnpm 12.8.1 is the package manager
under the hood (pins in `.node-version`/`.nvmrc`/`packageManager`). On
Windows, disable Git autocrlf before cloning. Install dependencies with
`vp install --frozen-lockfile`. Shared packages export TypeScript source and
need no build.

`vp run dev` starts TanStack Start on port 3000: document, assets, server
functions and `/api` run in local workerd with local D1. First copy
`frontend/.dev.vars.example` to `frontend/.dev.vars` and apply migrations with
`vp run --filter @oxytype/frontend db:migrate`. Stop servers with Ctrl+C.

### Lightweight frontend development

`vp run dev` keeps HMR enabled and skips automatic linting, Solid/TanStack
devtools, Vite inspection and result-chart warmup. Command palette, dev options
and the event-log viewer load when first opened. Router intent preloading stays
on.

For UI/typing work without a backend, run
`vp run --filter @oxytype/frontend dev:offline`.
This uses shared local configuration defaults, skips auth/session subscriptions,
blocks API requests and disables query retries. A banner identifies this mode.
Login, saved results, account data and server features require normal development
with a backend. Local assets/languages still load normally; network-dependent
funboxes still require their external services. Production builds never use this mode.

Enable diagnostics as needed, through environment variables or `frontend/.env`:

- `DEV_LINT=fast`: automatic lint without type checking.
- `DEV_LINT=true`: automatic lint plus type-aware/type checks.
- `DEV_TOOLS=true`: Solid/TanStack devtools overlays.
- `DEV_INSPECT=true`: Vite plugin inspection at `/__inspect/`.
- `DEV_PREFETCH=true`: result-chart warmup during tests.

Restart the server after changing these flags. Automatic lint uses a 750 ms
debounce. Run `vp run lint-fe` for full frontend checks on demand; commit hooks
and [CI](CI.md) also check changes.

For development with tests, use two terminals. Run `vp run dev` in one and
`vp -C frontend test watch` in the other. Stop each with Ctrl+C. The combined
`dev-test` command has been retired.

```sh
DEV_TOOLS=true vp run dev
DEV_LINT=fast DEV_INSPECT=true vp run dev
DEV_PREFETCH=true vp run dev
```

Use one server per actively edited checkout. Additional tabs on that server share
its transform cache; separate worktrees need separate servers. For a reference
checkout, build once and run `vp run --filter @oxytype/frontend start`; rebuilding
is required to see subsequent changes.
For a separate preview port, run `vp preview --port 3101` from `frontend` after
`vp run build` completes at the repository root; preview runs the built Worker
in workerd. A production build requires `TURNSTILE_SITE_KEY`.

Keep browser devtools' **Disable cache** unchecked for routine development.
Close unused tabs. Hidden development tabs pause cosmetic anime.js animations;
the typing clock uses independent, wall-clock-anchored timeouts and still detects
timer drift. Power-effect canvases allocate only while that effect is enabled.
Language JSON caches retain eight entries; shared JSON/layout caches retain
sixteen. Evicted assets reload on demand, and failed loads can retry. Result history stays retained
for synchronous typing/PB consumers. HMR disposes module subscriptions, derived
state, collections, audio and component-owned DOM watchers.

Google/GitHub login requires deployment-owned OAuth credentials/callbacks.
Email/password/reset flows remain disabled. See
[Cloudflare operations](CLOUDFLARE_OPERATIONS.md) for authentication, configuration,
Worker bindings, local data, integration setup and deployment.

For browser checks against the official Oxytype staging site, follow
[staging setup](STAGING_SETUP.md). Use its hosted URL for OAuth testing.

Use `vp lint --type-aware --type-check --format agent` for type checking;
`vp fmt` formats files. Commit hooks enforce formatting and lint.
Run a single test with `vp test run path/to/test.ts` from its package. Backend
Backend `test` runs service/policy/HTTP-handler checks; `integration-test` runs
workerd-backed D1 checks; frontend `test:start` runs SSR/workerd suites. Frontend imperative DOM work belongs in component refs/lifecycles; styling
uses Tailwind classes, `cn` and configured colors; icons use `Fa`.

Run the browser suites with `vp run test-e2e` after `vp run build`. Install the browser once:
`vp -C frontend exec playwright install chromium`. They serve the built Start
Worker with seeded D1 fixtures on port 4185. Failed runs retain traces and
screenshots in `frontend/test-results/`.

Circular imports are rejected by oxlint's `import/no-cycle` rule.

Check unused code and dependencies:

```sh
vp run knip
```

`knip.ts` supplies a public Turnstile test key only during analysis. Production
builds still require their own key. The workspace graph includes tests, build
plugins, CSS and maintenance scripts; review callers before removing reported
exports. Scoped ignores explain tooling dependencies and generated font CSS.

See [contribution guidelines](CONTRIBUTING.md) and [architecture](ARCHITECTURE.md).

## Direct package-manager calls

Run everything through `vp` (`vp install`, `vp run`, `vp exec`, `vp dlx`,
`vp add`). Remaining direct calls, each required:

- Root `preinstall`: `npx only-allow pnpm`. Dependencies aren't installed yet,
  and `vp dlx` runs pnpm dlx, which overrides the user agent so the check always
  passes.
