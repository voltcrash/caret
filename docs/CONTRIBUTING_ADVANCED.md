# Advanced development setup

Use Git, Node 24.21.0 and Vite+ (`vp`); pnpm 12.8.1 is the package manager
under the hood (pins in `.node-version`/`.nvmrc`/`packageManager`). On
Windows, disable Git autocrlf before cloning. Install dependencies with
`vp install --frozen-lockfile`. Shared packages export TypeScript source and
need no build.

For frontend-only work, `vp run dev-fe` starts Solid/Vite on port 3000. To run the
backend, copy `backend/.dev.vars.example` to `backend/.dev.vars`, apply local D1
migrations with `vp run --filter @oxytype/frontend db:migrate`, then `vp run dev-be`.
Wrangler serves the API with local D1 on port 5005.
`vp run dev` starts the full workspace. Stop servers with Ctrl+C.

### Lightweight frontend development

`vp run dev-fe` keeps HMR enabled and skips automatic linting, signal tracking,
Solid/TanStack devtools, Vite inspection, CSS sourcemaps and bulk modal prefetching.
Command palette, dev options and the event-log viewer load when first opened.
API routers initialize on their first request. Development also skips hover page
prefetching and chart warmup; the first visit/open may take longer. Production
retains speculative prefetching and its build plugins.

For UI/typing work without a backend, run `DEV_OFFLINE=true vp run dev-fe`.
This uses shared local configuration defaults, skips auth/session subscriptions,
blocks API requests and disables query retries. A banner identifies this mode.
Login, saved results, account data and server features require normal development
with a backend. Local assets/languages still load normally; network-dependent
funboxes still require their external services. Production builds ignore this flag.

Enable diagnostics as needed, through environment variables or `frontend/.env`:

- `DEV_LINT=fast`: automatic lint without type checking.
- `DEV_LINT=true`: automatic lint plus type-aware/type checks.
- `DEV_TOOLS=true`: Solid/TanStack devtools and signal tracking.
- `DEV_INSPECT=true`: Vite plugin inspection at `/__inspect/`.
- `DEV_CSS_SOURCEMAPS=true`: original CSS locations in browser devtools.
- `DEV_PREFETCH=true`: hover page prefetching and result-chart warmup.
- `DEV_OFFLINE=true`: frontend-only configuration with backend traffic disabled.

Restart the server after changing these flags. Automatic lint uses a 750 ms
debounce. Run `vp run lint-fe` for full frontend checks on demand; commit hooks
and CI also check changes.

```sh
DEV_TOOLS=true vp run dev-fe
DEV_LINT=fast DEV_INSPECT=true vp run dev-fe
DEV_OFFLINE=true vp run dev-fe
DEV_PREFETCH=true vp run dev-fe
```

Use one server per actively edited checkout. Additional tabs on that server share
its transform cache; separate worktrees need separate servers. For a reference
checkout, build once and run `vp run --filter @oxytype/frontend start`; rebuilding
is required to see subsequent changes.
For a separate preview port, run `vp preview --port 3101` from `frontend` after
`vp run build-fe` completes at the repository root. A production build requires
`TURNSTILE_SITE_KEY`; built previews use production configuration.

Keep browser devtools' **Disable cache** unchecked for routine development.
Close unused tabs. Hidden development tabs pause cosmetic anime.js animations;
the typing clock uses independent, wall-clock-anchored timeouts and still detects
timer drift. Power-effect canvases allocate only while that effect is enabled.
Language JSON caches retain eight entries; shared JSON/layout caches retain
sixteen. Evicted assets reload on demand, and failed loads can retry. Inactive
terminal-history queries expire after five minutes; web history stays retained
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
`test` runs controllers/HTTP checks; `integration-test` runs workerd-backed D1
checks. Frontend imperative DOM work belongs in component refs/lifecycles; styling
uses Tailwind classes, `cn` and configured colors; icons use `Fa`.

Run the web typing smoke test with `vp run test-e2e`. Install its browser once:
`vp -C frontend exec playwright install chromium`. The single spec starts a fresh
offline dev server on port 4173, types 15 displayed words and checks WPM/accuracy.
No backend is needed; stop any other server using port 4173 first. Failed runs
retain traces and screenshots in `frontend/test-results/`.

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
- `tui` scripts: `bun scripts/*.ts`, `bun run src/index.tsx`, `bun test`. Bun is
  the OpenTUI runtime; script-to-script calls still use `vp run`.
- `tui/scripts/smoke-package.ts`: `npm pack`/`npm install` mimic end-user npm
  installs of the published package.
- `tui-release.yml`: `npm publish` ships the prebuilt `tui/dist/npm` directory
  with npm provenance.
- End-user install docs: `bunx`/`bun add --global`/`npm install --global` for the
  published `@voltcrash/oxytype` package.
