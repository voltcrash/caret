# CI performance

Caret CI keeps all existing suites. Backend inventory checks run separately so a frontend edit no longer runs the backend suite. SSR uses three isolated runners; browser tests keep whole spec files together and balance their recorded duration across four runners. Native and browser engine checks run concurrently.

## Browser measurements

Initial weights in `frontend/scripts/browser-durations.json` come from successful tests in [run 41000924522](https://github.com/voltcrash/caret/actions/runs/41000924522). They are seconds per project/spec, including repeated successful executions. New files get the mean recorded weight and are always included.

Each browser shard uploads a `start-browser-timings-N` artifact containing Playwright's JSON report. Sum `results[].duration / 1000` by project and spec file to refresh the weights. Keep whole files together: some tests mutate the shared fixture Worker.

Inspect a shard without starting a browser:

```sh
vp -C frontend exec vpx ./scripts/test-browser-shard.ts 1/4 --list
```

## Task results

Only the explicit `ci:lint:be`, `ci:lint:fe`, and `ci:build:start` tasks cache results. Vite Task tracks file reads, missing-file probes, directory listings and arguments. The build task also fingerprints the environment consumed by our plugins. Tests and deployments remain uncached.

Each job restores its own task-cache namespace after dependencies and engine bindings are ready. A successful job saves a new immutable snapshot; Vite Task validates individual fingerprints before reusing results. Fixture builds use the stable `ci-fixture` build ID. The update suite still builds two distinct versions without caching.

## Runner benchmark

Normal PRs and main pushes keep GitHub-hosted `ubuntu-latest`. Manual Caret CI runs accept a `heavy-runner` label for an already configured runner. Run the same revision once with `ubuntu-latest` and once with the candidate label; compare job execution and setup separately. The input provisions no runners or subscriptions. Keep one browser/SSR worker per runner until fixture and memory measurements justify increasing concurrency.

The production Worker stays a shared artifact. Removing that dependency would duplicate builds or require artifact polling; the dedicated runtime-test build instead runs alongside it and is shared by all SSR shards.
