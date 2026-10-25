# Frontend browser tests

DOM and component tests run in headless Chromium through Vitest Browser Mode
and Playwright. Source checks, build scripts, pure helpers, and client/server
contract tests run in Node. JSDOM and Happy DOM are no longer test environments.
Both packages and their unused optional Vitest copies are removed from the
dependency graph. `vp why happy-dom jsdom` returns no matches.

## Run tests

Install Chromium once, and again when the pinned Playwright version changes:

```sh
vp -C frontend exec playwright install --with-deps --only-shell chromium
```

From the repository root:

```sh
# All frontend tests, including Node tests.
vp run test-fe

# One component test.
vp -C frontend test run __tests__/components/common/Button.spec.tsx

# All browser tests, or only Node tests.
vp -C frontend test run --project browser
vp -C frontend test run --project node

# Native input, dialog focus, storage, and scrolling checks.
vp -C frontend test run __tests__/browser/native.browser.tsx __tests__/browser/lifecycle.browser.tsx
```

Browser files run in sequence with one worker. CI keeps its two file shards.
Vitest and its browser packages use 5.0.5, which includes the upstream fixes for
[mock interception](https://github.com/vitest-dev/vitest/commit/d6620fae6) and
[mock cleanup](https://github.com/vitest-dev/vitest/commit/e9c3d72f0).
Both shards install Chromium with system libraries. Failed tests save
screenshots in `frontend/.vitest/attachments`; CI uploads them for seven days.

## Test boundaries

- Use real browser APIs by default. A mock can still control one API or a
  measurement when a unit test needs a fixed input.
- Native interaction checks load app CSS and use Playwright input. They check
  trusted events, focus, dialog state, editing, scrolling, and cleanup.
- Register `vi.mock(path, { spy: true })` before spying on module exports.
  Browser module namespaces are sealed. Partial mocks must retain exports
  imported by other modules.
- Browser fixtures import JSON through Vite and load the real optimized Wasm.
  Node contract tests keep their filesystem loader and server validator.
- Tests of account session changes mock page warmup. Otherwise an idle page
  import can outlive the test frame and break the runner's mock connection.
- Browser tests use a test operation transport. Start server functions have
  explicit test replacements that throw unless a test mocks them. Importing
  server-only modules in a browser test fails at build time.
- This component runner does not compile or test Start's server functions.
  Existing `test:start` and Playwright end-to-end commands remain separate.

## Validation

The original suite had 2,162 cases in 242 files. The migration preserves each
file's case count and adds eight native browser checks. The comparison includes
the renamed `dom-ready.spec.ts` file and the tests moved into Node.

Local results, 2026-10-25:

| Environment | Files | Cases | Result |
| --- | ---: | ---: | --- |
| Node | 27 | 284 | Pass |
| Chromium | 217 | 1,886 | Pass |
| Total | 244 | 2,170 | Pass |

After removing dependencies, both CI shard commands passed: 1,041 cases in
shard 1 and 1,129 in shard 2. Their combined file and case counts match the full
run. No old files or cases are missing. No cases were skipped.

Also passed: 27 checks through the root runner, 437 shared package checks
(including 68 CI routing checks), frontend lint and type checks, and Knip.
The package removal pruned 56 package versions and added no unrelated versions.

GitHub CI results are tracked on the pull request. These local checks cover
Chromium; Firefox and WebKit were not tested.

An earlier pilot recorded a timing comparison. Its 24% reduction applies only to that 54-case sample. It is not a
full-suite or CI speed claim. Chromium installation time was not in that sample.
