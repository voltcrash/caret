# Browser Mode pilot

Date: 2026-10-24. Base commit: `d2cb7438e`.

## Result

All 54 existing tests pass in both the current setup and Chromium Browser Mode.
Their test files required no changes. Four extra browser tests also pass.
The final Browser Mode check passed all 58 cases with `--repeats 4` and no retries.

The pilot supports a gradual move to Browser Mode. It does not yet support
removing JSDOM or Happy DOM from the full project.

## Sample

| Existing test file | Current environment | Cases | Chromium |
| --- | --- | ---: | --- |
| `components/common/Button.spec.tsx` | JSDOM | 17 | Pass |
| `components/ui/Select.spec.tsx` | JSDOM | 9 | Pass |
| `hooks/useInputListener.spec.tsx` | JSDOM | 1 | Pass |
| `utils/type-to-search.spec.ts` | Happy DOM | 6 | Pass |
| `utils/local-storage-with-schema.spec.ts` | Happy DOM | 21 | Pass |

Paths start at `frontend/__tests__/`.

Extra browser checks use the real app CSS and Playwright input:

- Search a select control, select with Enter, then move focus with Tab.
- Activate a button with a mouse and Enter. Check that the event comes from
  browser input, that the button has a nonzero width, and that app CSS applies.
- Detect a real editable element without replacing `isContentEditable`.
- Save and read settings with the browser's real local storage.

The existing tests still use their original simulated input and storage mocks.
Moving a test to a browser does not automatically remove its mocks. The four
extra checks show the separate benefit of real input and browser APIs.

## Timing

| Run | Current setup | Browser Mode |
| --- | ---: | ---: |
| 1 | 4.311 s | 3.466 s |
| 2 | 4.812 s | 3.274 s |
| 3 | 4.508 s | 3.417 s |
| Middle result | **4.508 s** | **3.417 s** |

Browser Mode used about **24% less total time** for this sample.
The actual test-file execution time was almost the same: middle totals of
0.526 s for the current setup and 0.524 s for Browser Mode. The main gain was
in setup and other work outside the tests.

Method:

- Same Linux ARM64 machine, Node 24.21.0, Vite+ 1.0.0, Vitest 5.0.3,
  Playwright 1.63.0, headless Chromium.
- One initial run per setup before the timed runs. Dependency and transform
  caches were available. A browser was already installed.
- Three separate command runs per setup, with order changed between rounds.
  No simultaneous benchmark runs.
- One worker; test files run in sequence; no retries.
- Python's monotonic clock measured the whole command, including startup,
  transforms, environment setup, browser launch, tests, and shutdown.
- Both timed setups ran exactly the same 54 cases. The four extra browser
  checks were excluded from the timing comparison.
- The current setup uses two projects: JSDOM and Happy DOM. Browser Mode uses
  one. These figures compare the practical configurations, not only the speed
  of their DOM APIs.

Raw per-run measurements: [browser-mode-pilot-results.json](browser-mode-pilot-results.json).

## Implementation and limits

The opt-in config is `frontend/storybook/vitest.pilot.config.ts`. It uses the
browser provider already installed in the Storybook workspace. No package or
lockfile change was needed. The normal test config and application code are
unchanged. The native test file uses `.browser.tsx`, so normal test discovery
does not select it.

Browser setup retains the application owner, test element fixtures and auth
mock. It uses real `matchMedia`. It omits the Node filesystem asset mock;
these selected tests do not need that mock. Native checks load Tailwind and
the existing font plugin. Type checking required a Vite CSS type reference
in the browser-only file. Assertions use `expect.poll` to wait for browser
state without adding browser matcher type declarations.

Lint, type checks, formatting and whitespace checks pass for the new files.
No product bug was found in this sample. Existing Storybook build problems
did not prevent this separate test config from running.

This is a small local sample. It does not test CI speed, browser installation
time, memory use, Firefox, WebKit, complete user tasks, the full typing page,
native dialogs, or the full test suite. Node-dependent tests and tests that
spy directly on imported module exports can need further changes.

## Run again

From the repository root:

```sh
# Original 54 cases in their existing environments.
vp test run --config frontend/storybook/vitest.pilot.config.ts --project pilot-jsdom --project pilot-happy-dom

# The same 54 cases in Chromium.
vp test run --config frontend/storybook/vitest.pilot.config.ts --project pilot-browser --exclude '**/native.browser.tsx'

# All 58 cases, with four additional executions of each case.
vp test run --config frontend/storybook/vitest.pilot.config.ts --project pilot-browser --repeats 4

# Check pilot source files.
vp lint frontend/storybook/vitest.pilot.config.ts frontend/__tests__/browser-pilot --type-aware --type-check --format agent
```

If Chromium is absent, run this command in `frontend/storybook`:

```sh
vp exec playwright install chromium
```

## Recommended next step

Expand the trial to modal focus, typing input, scrolling, and tests with many
mocks. Test that group in CI. Keep pure logic tests in Node where possible.
Remove a DOM library only after its remaining tests have a verified home.

References:

- [Vitest Browser Mode](https://vitest.dev/guide/browser/)
- [Vitest component testing](https://vitest.dev/guide/browser/component-testing)
