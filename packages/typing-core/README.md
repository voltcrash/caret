# Typing core

Headless TypeScript source for the web typing test. No build step, browser
state, DOM rendering or implicit network/storage access. Import from
`@oxytype/typing-core` or a subpath such as `@oxytype/typing-core/events/stats`.

`createWordsGenerator(deps)` handles all modes, punctuation/numbers, repeats,
custom sections and funbox transforms. Supply config/state getters, custom text,
a `QuotesController`, and language transforms. Language, quote, poetry and
Wikipedia loaders accept client-owned fetch/asset adapters. Wikipedia additionally
accepts an HTML-to-text adapter.

`createTestSession(config, deps)` creates independent event, input and timer state.
Config may be an object or a getter. Supply initial `words` (including inter-word
commit separators; omit the last separator for a finite test), or call
`generate(language, generator)`. A generator's `getWordsLength` should read
`session.getWords().length`; provide it via `deps.generator` for ongoing generation.
`getContext` can provide live quote/custom-text/word state for an existing client.

- `await session.insert(text, timestamp)` and `session.delete(type, timestamp)`
  apply input rules. Serialize input calls when generation awaits an asset.
- `session.record(type, timestamp, data)` records physical key events and IME
  metadata.
- `session.advance(timestamp)` emits due ticks; clients own the scheduler and
  may drive `session.clock` directly. Ticks check the time limit and minimum
  speed/accuracy and finish with a reason; `deps.isSlowTimer` flags slow steps.
- `session.on("word" | "input" | "tick" | "drift" | "finish", listener)` returns
  an unsubscribe function. `finish(timestamp, reason?)` ends and notifies;
  `end(timestamp)` ends silently; `abandon(timestamp)` ends silently and
  measures an incomplete test. `getFinishReason()` reads the failure reason
  until `reset()`, which restarts state while retaining target words.
- `session.pace` tracks the pace caret: `reset(wpm)`, `step()` or
  `advanceTo(timestamp)`, and word corrections on commit. It remembers the last
  test's speed across resets.
- `session.getReplay()` returns letter-level replay steps; `replay` applies and
  seeks them. `typing-time` counts time typed this session or today.
- Finalize held keys with `recorder.forceReleaseAllKeys()` and
  `recorder.cleanupData()`, then use `buildEventLog()` and
  `complete(log, context)` to build the result. `hashResult({...result, uid})`
  preserves the web payload hash.

`config/default-config` and `config/migrate` provide the web default config and
`migrateConfig` (legacy values, schema repair, default merge). `themes` holds the
built-in palettes and custom-theme colour conversion. The frontend re-exports
these modules. `config/metadata` holds setting labels, descriptions, groups,
option visibility and value/override/block rules; clients add icons and show
block reasons. `config/funbox-validation` checks funbox/config compatibility;
`config/setter` resolves one change, including dependent settings, without
applying it. `command-matching` holds the command palette's word-prefix
filtering.

`format`, `typing-speed-units` and `live-stats` share the web's number/unit,
timer/progress and blind-mode display rules. `quick-restart` shares long-test
protection; `result-validity` shares save eligibility. `custom-text` supplies the
default text, and `strings` supplies character splitting. Duration formatting
lives in `@oxytype/util/date-and-time`. The web re-exports these helpers too.

The web uses this facade for event state, the timer, pace caret, replay, word
generation and results. Its input handlers use the same pure
insertion/deletion/validation rules; scheduling, rendering, composition
lifecycle, scrolling and browser key handling stay with the web.

Parity tests retain eight real web keystroke recordings and 61 seeded generator
snapshots. Core tests run in Node. From the root:

```sh
vp run lint-pkg
vp run test-pkg
vp test run packages/typing-core/__test__/session.spec.ts
```

`__fixtures__/keystrokes` contains raw input/timings, event logs and result
snapshots/hashes. `scripts/record-fixtures.ts` records web fixtures against a running
frontend. Only regenerate baseline snapshots for intentional behavior changes.
