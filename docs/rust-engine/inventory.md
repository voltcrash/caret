# Migration inventory

Frozen at `7b1ae05f204be53b5d9f2714f21c6eea08b25935`. Sole implementation owner.

## Source ownership and destination

| Current module | Classification | Destination |
| --- | --- | --- |
| `active-funboxes.ts` | Engine | crates/typing-engine |
| `arrays.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `british-english-replacements.ts` | Content asset | shared replacement data |
| `british-english.ts` | Engine | crates/typing-engine |
| `command-matching.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `completed-event.ts` | Engine | crates/typing-engine |
| `config/default-config.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `config/funbox-validation.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `config/metadata.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `config/migrate.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `config/setter.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `custom-text.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `ddr.ts` | Engine | crates/typing-engine |
| `english-punctuation.ts` | Engine | crates/typing-engine |
| `errors.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `events/data.ts` | Engine | crates/typing-engine |
| `events/helpers.ts` | Engine | crates/typing-engine |
| `events/live-cache.ts` | Engine | crates/typing-engine |
| `events/stats/bursts.ts` | Engine | crates/typing-engine |
| `events/stats/characters.ts` | Engine | crates/typing-engine |
| `events/stats/intervals.ts` | Engine | crates/typing-engine |
| `events/stats/key-timing.ts` | Engine | crates/typing-engine |
| `events/stats/speed-history.ts` | Engine | crates/typing-engine |
| `events/stats/timing.ts` | Engine | crates/typing-engine |
| `events/stats/word-history.ts` | Engine | crates/typing-engine |
| `events/stats.ts` | Engine | crates/typing-engine |
| `events/types.ts` | Shared contract | generated bindings + checked web DTOs |
| `format.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `funbox-word-functions.ts` | Engine | crates/typing-engine |
| `generate.ts` | Engine | crates/typing-engine |
| `index.ts` | Re-export | retire |
| `input/config.ts` | Shared contract | generated bindings + checked web DTOs |
| `input/engine.ts` | Engine | crates/typing-engine |
| `input/fail-or-finish.ts` | Engine | crates/typing-engine |
| `input/input-type.ts` | Shared contract | generated bindings + checked web DTOs |
| `input/util.ts` | Engine | crates/typing-engine |
| `input/validation.ts` | Engine | crates/typing-engine |
| `ip-addresses.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `keys.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `languages.ts` | Content host adapter | TypeScript content adapters; Rust selection/transforms |
| `layout-emulator.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `lazy-mode.ts` | Engine | crates/typing-engine |
| `live-stats.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `mode.ts` | Engine | crates/typing-engine |
| `numerals.ts` | Engine | crates/typing-engine |
| `pace-caret.ts` | Engine | crates/typing-engine |
| `poetry.ts` | Content host adapter | TypeScript content adapters; Rust selection/transforms |
| `practise-words.ts` | Engine | crates/typing-engine |
| `quick-restart.ts` | Engine | crates/typing-engine |
| `quote-source.ts` | Content host adapter | TypeScript content adapters; Rust selection/transforms |
| `quotes.ts` | Engine | crates/typing-engine |
| `replay.ts` | Engine | crates/typing-engine |
| `restart.ts` | Engine | crates/typing-engine |
| `result-fields.ts` | Engine | crates/typing-engine |
| `result-hash.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `result-validity.ts` | Engine | crates/typing-engine |
| `session.ts` | Engine | crates/typing-engine |
| `stats-math.ts` | Engine | crates/typing-engine |
| `strings.ts` | Engine | crates/typing-engine |
| `themes.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `timer.ts` | Engine | crates/typing-engine |
| `typing-speed-units.ts` | Presentation/settings/transport | scoped TypeScript packages, SSR safe |
| `typing-time.ts` | Engine | crates/typing-engine |
| `weak-spot.ts` | Engine | crates/typing-engine |
| `wikipedia.ts` | Content host adapter | TypeScript content adapters; Rust selection/transforms |
| `words-generator/funboxes.ts` | Engine | crates/typing-engine |
| `words-generator/limits.ts` | Engine | crates/typing-engine |
| `words-generator/next-word.ts` | Engine | crates/typing-engine |
| `words-generator/punctuation.ts` | Engine | crates/typing-engine |
| `words-generator/quotes.ts` | Engine | crates/typing-engine |
| `words-generator/state.ts` | Engine | crates/typing-engine |
| `words-generator/transforms.ts` | Engine | crates/typing-engine |
| `words-generator/types.ts` | Shared contract | generated bindings + checked web DTOs |
| `words-generator.ts` | Engine | crates/typing-engine |
| `wordset.ts` | Engine | crates/typing-engine |

Split `strings`: display utilities stay TS; input normalization/countChars move to Rust.
Settings metadata/migration stays TS; rule policies/defaults generated from Rust.
`live-stats` formats display; score derivation moves to Rust.
`ip-addresses` includes funbox generation: move those rules to Rust.
`layout-emulator` is host key translation, supplied as observations.

## Consumer map

Includes mocks, scripts, type-only imports, server imports, re-exports, and manifests.

```text
./frontend/src/ts/utils/result-hash.ts:1:export * from "@oxytype/typing-core/result-hash";
./frontend/src/ts/utils/quick-restart.ts:1:export { canQuickRestart } from "@oxytype/typing-core/quick-restart";
./frontend/src/ts/utils/misc.ts:72:export { getMode2 } from "@oxytype/typing-core/mode";
./frontend/src/ts/utils/json-data.ts:9:} from "@oxytype/typing-core/languages";
./frontend/src/ts/utils/ip-addresses.ts:1:export * from "@oxytype/typing-core/ip-addresses";
./frontend/src/ts/utils/format.ts:1:export { Formatting } from "@oxytype/typing-core/format";
./frontend/package.json:62:    "@oxytype/typing-core": "workspace:*",
./frontend/src/ts/utils/arrays.ts:5:} from "@oxytype/typing-core/arrays";
./frontend/src/ts/utils/typing-speed-units.ts:1:export { get } from "@oxytype/typing-core/typing-speed-units";
./frontend/src/ts/utils/typing-speed-units.ts:2:export type { TypingSpeedUnitSettings } from "@oxytype/typing-core/typing-speed-units";
./frontend/src/ts/input/helpers/word-navigation.ts:1:import { getPreviousWordInput } from "@oxytype/typing-core/input/engine";
./frontend/src/ts/input/helpers/word-navigation.ts:21:import { getWordBurst } from "@oxytype/typing-core/events/stats";
./frontend/src/ts/input/helpers/validation.ts:1:import * as Core from "@oxytype/typing-core/input/validation";
./frontend/src/ts/utils/strings.ts:2:import { removeLanguageSize } from "@oxytype/typing-core/strings";
./frontend/src/ts/utils/strings.ts:9:} from "@oxytype/typing-core/strings";
./frontend/src/ts/utils/strings.ts:103:export { cleanTypographySymbols } from "@oxytype/typing-core/strings";
./frontend/src/ts/utils/strings.ts:185:export { areCharactersVisuallyEqual } from "@oxytype/typing-core/strings";
./frontend/src/ts/utils/strings.ts:205:export { isSpace } from "@oxytype/typing-core/strings";
./frontend/src/ts/utils/strings.ts:215:export { countChars } from "@oxytype/typing-core/strings";
./frontend/src/ts/input/helpers/util.ts:1:import * as Core from "@oxytype/typing-core/input/util";
./frontend/src/ts/input/helpers/input-type.ts:1:export * from "@oxytype/typing-core/input/input-type";
./frontend/src/ts/input/helpers/fail-or-finish.ts:1:import * as Core from "@oxytype/typing-core/input/fail-or-finish";
./frontend/src/ts/input/handlers/insert-text.ts:1:import { evaluateInsert } from "@oxytype/typing-core/input/engine";
./frontend/src/ts/input/handlers/before-insert-text.ts:1:import { shouldBlockInsertion } from "@oxytype/typing-core/input/engine";
./frontend/src/ts/input/handlers/before-delete.ts:1:import { canDelete } from "@oxytype/typing-core/input/engine";
./frontend/src/ts/states/test.ts:7:import { EventLog } from "@oxytype/typing-core/events/types";
./frontend/src/ts/states/test.ts:16:import { QuoteWithTextSplit } from "@oxytype/typing-core/quotes";
./frontend/src/ts/states/result.ts:10:import type { ReplayWord } from "@oxytype/typing-core/replay";
./frontend/src/ts/states/live-stats.ts:3:import * as LiveStats from "@oxytype/typing-core/live-stats";
./frontend/src/ts/states/event-log-viewer.ts:6:} from "@oxytype/typing-core/events/types";
./frontend/src/ts/controllers/quotes-controller.ts:4:import { QuotesController as CoreQuotesController } from "@oxytype/typing-core/quote-source";
./frontend/src/ts/controllers/quotes-controller.ts:5:import { Quote } from "@oxytype/typing-core/quotes";
./frontend/src/ts/controllers/quotes-controller.ts:6:export type { Quote } from "@oxytype/typing-core/quotes";
./frontend/src/ts/constants/themes.ts:1:export * from "@oxytype/typing-core/themes";
./frontend/src/ts/constants/keys.ts:1:import { Keycode } from "@oxytype/typing-core/keys";
./frontend/src/ts/constants/keys.ts:2:export type { Keycode } from "@oxytype/typing-core/keys";
./frontend/src/ts/constants/default-config.ts:2:import { getDefaultConfig as getBaseDefaultConfig } from "@oxytype/typing-core/config/default-config";
./frontend/src/ts/constants/default-config.ts:6:} from "@oxytype/typing-core/themes";
./frontend/src/ts/config/utils.ts:5:} from "@oxytype/typing-core/config/migrate";
./frontend/src/ts/config/metadata.tsx:8:} from "@oxytype/typing-core/config/metadata";
./frontend/src/ts/config/lifecycle.ts:22:import { lastConfigsToApply } from "@oxytype/typing-core/config/setter";
./frontend/src/ts/config/funbox-validation.ts:5:} from "@oxytype/typing-core/config/funbox-validation";
./frontend/src/ts/components/modals/EventLogViewerModal.tsx:1:import type { EventLog } from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/video-sync.ts:2:import type { TestEventNoMs } from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/timeline-lanes.ts:5:} from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/PreviewContent.tsx:1:import type { EventLog } from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/EventsPanel.tsx:4:} from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/scatter-points.ts:1:import type { TestEventNoMs } from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/DistributionPanel.tsx:1:import type { EventLog } from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/DistributionPanel.tsx:6:} from "@oxytype/typing-core/events/stats";
./frontend/src/ts/components/modals/event-log-viewer/event-log.ts:5:} from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/event-log.ts:7:import { getInputFromDom } from "@oxytype/typing-core/events/helpers";
./frontend/src/ts/components/modals/event-log-viewer/event-log.ts:8:import { EVENT_LOG_VERSION } from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/createVideoSync.ts:9:import type { TestEventNoMs } from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/createPlayback.ts:3:import type { TestEventNoMs } from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/Timeline.tsx:1:import type { TestEventType } from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/ScatterPanel.tsx:1:import type { EventLog } from "@oxytype/typing-core/events/types";
./frontend/src/ts/components/modals/event-log-viewer/ScatterPanel.tsx:6:} from "@oxytype/typing-core/events/stats";
./frontend/src/ts/commandline/matching.ts:1:export { matchCommands } from "@oxytype/typing-core/command-matching";
./frontend/src/ts/commandline/lists/result-screen.ts:13:import { getInputHistory } from "@oxytype/typing-core/events/stats";
./frontend/src/app/theme-vars.ts:1:import type { Theme } from "@oxytype/typing-core/themes";
./frontend/src/app/theme-bootstrap.ts:1:import { defaultThemes } from "@oxytype/typing-core/config/default-config";
./frontend/src/app/theme-bootstrap.ts:2:import { themes } from "@oxytype/typing-core/themes";
./frontend/src/features/typing/runtime/words-generator.ts:1:import { createWordsGenerator } from "@oxytype/typing-core/words-generator";
./frontend/src/features/typing/runtime/words-generator.ts:10:import * as LazyMode from "@oxytype/typing-core/lazy-mode";
./frontend/src/features/typing/runtime/words-generator.ts:11:import * as EnglishPunctuation from "@oxytype/typing-core/english-punctuation";
./frontend/src/features/typing/runtime/wikipedia.ts:1:import { getSection as loadSection } from "@oxytype/typing-core/wikipedia";
./frontend/src/features/typing/runtime/wikipedia.ts:2:import { Section } from "@oxytype/typing-core/languages";
./frontend/src/features/typing/runtime/weak-spot.ts:1:import { createWeakSpot } from "@oxytype/typing-core/weak-spot";
./frontend/src/features/typing/runtime/layout-emulator.ts:2:import { getCharFromLayout } from "@oxytype/typing-core/layout-emulator";
./frontend/src/features/typing/runtime/today-tracker.ts:4:} from "@oxytype/typing-core/typing-time";
./frontend/src/features/typing/runtime/initialization.ts:42:import { WordGenError } from "@oxytype/typing-core/errors";
./frontend/src/features/typing/runtime/initialization.ts:54:import { hasKoreanCharacters } from "@oxytype/typing-core/strings";
./frontend/src/features/typing/runtime/timer-scheduler.ts:1:import type { TestTimer } from "@oxytype/typing-core/timer";
./frontend/src/features/typing/runtime/custom-text.ts:8:import { defaultCustomTextSettings } from "@oxytype/typing-core/custom-text";
./frontend/src/features/typing/runtime/completion.client.ts:63:} from "@oxytype/typing-core/events/stats";
./frontend/src/features/typing/runtime/completion.client.ts:68:} from "@oxytype/typing-core/result-validity";
./frontend/src/features/typing/runtime/completion.client.ts:72:import { countInvalidResultFields } from "@oxytype/typing-core/result-fields";
./frontend/src/features/typing/runtime/british-english.ts:1:import { replace as replaceWord } from "@oxytype/typing-core/british-english";
./frontend/src/features/typing/runtime/test-timer.ts:3:import type { SessionEvents } from "@oxytype/typing-core/session";
./frontend/src/features/typing/runtime/test-timer.ts:4:import { getTimeLimit } from "@oxytype/typing-core/timer";
./frontend/src/app/default-theme.ts:2:import { defaultThemes } from "@oxytype/typing-core/config/default-config";
./frontend/src/features/typing/runtime/result/history.ts:12:} from "@oxytype/typing-core/events/stats";
./frontend/src/features/typing/runtime/test-logic.ts:76:import { shouldRepeatQuote } from "@oxytype/typing-core/restart";
./frontend/src/features/typing/runtime/result/chart-data.ts:15:} from "@oxytype/typing-core/events/stats";
./frontend/src/features/typing/runtime/result/accuracy.ts:2:import { getAccuracy } from "@oxytype/typing-core/events/stats";
./frontend/src/server/operation.server.ts:19:import { migrateConfig } from "@oxytype/typing-core/config/migrate";
./frontend/src/features/typing/runtime/replay.ts:5:import { getWpmHistory } from "@oxytype/typing-core/events/stats";
./frontend/src/features/typing/runtime/replay.ts:12:} from "@oxytype/typing-core/replay";
./frontend/src/features/typing/runtime/funbox/funbox-functions.ts:2:import { FunboxWordFunctions } from "@oxytype/typing-core/active-funboxes";
./frontend/src/features/typing/runtime/funbox/funbox-functions.ts:3:import { createFunboxWordFunctions } from "@oxytype/typing-core/funbox-word-functions";
./frontend/src/features/typing/runtime/practise-words.ts:1:import { buildPracticeWords } from "@oxytype/typing-core/practise-words";
./frontend/src/features/typing/runtime/events/live-cache.ts:3:import { createLiveCache } from "@oxytype/typing-core/events/live-cache";
./frontend/src/features/typing/runtime/events/data.ts:4:import { createTestSession } from "@oxytype/typing-core/session";
./frontend/src/features/typing/runtime/events/data.ts:5:import { EventLogContext } from "@oxytype/typing-core/events/types";
./frontend/src/features/typing/runtime/poetry.ts:1:import { getPoem as loadPoem } from "@oxytype/typing-core/poetry";
./frontend/src/features/typing/runtime/poetry.ts:2:import { Section } from "@oxytype/typing-core/languages";
./frontend/src/features/typing/components/result/ResultWordsHistory.tsx:5:} from "@oxytype/typing-core/events/stats";
./frontend/src/features/typing/components/result/ResultReplay.tsx:1:import type { ReplayLetter } from "@oxytype/typing-core/replay";
./frontend/src/features/typing/components/result/ResultChart.tsx:8:import { getWordIndexesForSecond } from "@oxytype/typing-core/events/stats";
./frontend/src/features/settings/sidebar-skeleton.tsx:1:import { getDefaultConfig } from "@oxytype/typing-core/config/default-config";
./frontend/scripts/measure-input-snapshots.ts:2:import { createEventRecorder } from "@oxytype/typing-core/events/data";
./frontend/scripts/measure-input-snapshots.ts:3:import { createLiveCache } from "@oxytype/typing-core/events/live-cache";
./frontend/__tests__/input/helpers/fail-or-finish.spec.ts:8:import * as Misc from "@oxytype/typing-core/mode";
./frontend/__tests__/input/helpers/fail-or-finish.spec.ts:13:vi.mock("@oxytype/typing-core/mode", async (importOriginal) => {
./frontend/__tests__/input/helpers/fail-or-finish.spec.ts:15:    await importOriginal<typeof import("@oxytype/typing-core/mode")>();
./frontend/__tests__/input/handlers/insert-text.spec.ts:143:} from "@oxytype/typing-core/events/helpers";
./frontend/__tests__/input/handlers/insert-text.spec.ts:144:import type { InputEventNoMs } from "@oxytype/typing-core/events/types";
./frontend/__tests__/test/timer-scheduler.spec.ts:1:import { createTestTimer, type TimerTick } from "@oxytype/typing-core/timer";
./frontend/__tests__/test/test-logic.spec.ts:6:import type { QuoteWithTextSplit } from "@oxytype/typing-core/quotes";
./frontend/__tests__/test/test-logic.spec.ts:251:vi.mock("@oxytype/typing-core/result-validity", () => ({
./frontend/__tests__/test/result.spec.ts:89:vi.mock("@oxytype/typing-core/events/stats", () => ({
./frontend/__tests__/test/events/stats.spec.ts:75:} from "@oxytype/typing-core/events/helpers";
./frontend/__tests__/test/events/stats.spec.ts:95:} from "@oxytype/typing-core/events/stats";
./frontend/__tests__/test/events/stats.spec.ts:102:} from "@oxytype/typing-core/events/types";
./frontend/__tests__/test/events/helpers.spec.ts:14:} from "@oxytype/typing-core/events/helpers";
./frontend/__tests__/test/events/helpers.spec.ts:16:import type { InputEvent } from "@oxytype/typing-core/events/types";
./frontend/__tests__/test/events/data.spec.ts:22:} from "@oxytype/typing-core/events/types";
./frontend/__tests__/test/events/data.spec.ts:24:import { getEventsPerWord } from "@oxytype/typing-core/events/helpers";
./frontend/__tests__/test/events/anticheat.spec.ts:13:import { calculateWpm } from "@oxytype/typing-core/stats-math";
./frontend/__tests__/test/events/anticheat.spec.ts:17:} from "@oxytype/typing-core/events/types";
./frontend/__tests__/test/events/anticheat.spec.ts:31:} from "@oxytype/typing-core/events/stats";
./frontend/__tests__/test/characterization/replay.spec.ts:4:import type { EventLog } from "@oxytype/typing-core/events/types";
./frontend/__tests__/test/characterization/lifecycle.spec.ts:3:import type { EventLog } from "@oxytype/typing-core/events/types";
./frontend/__tests__/components/pages/test/result/ResultWordsHistory.spec.tsx:32:vi.mock("@oxytype/typing-core/events/stats", () => ({
./frontend/__tests__/components/pages/test/result/ResultReplay.spec.tsx:1:import type { EventLog } from "@oxytype/typing-core/events/types";
./frontend/__tests__/components/pages/test/result/ResultReplay.spec.tsx:32:  const { getReplaySteps } = await import("@oxytype/typing-core/replay");
./frontend/__tests__/components/pages/test/result/ResultReplay.spec.tsx:50:vi.mock("@oxytype/typing-core/events/helpers", async (importOriginal) => ({
./frontend/__tests__/components/pages/test/result/ResultReplay.spec.tsx:52:    typeof import("@oxytype/typing-core/events/helpers")
./frontend/__tests__/components/pages/test/result/ResultReplay.spec.tsx:56:vi.mock("@oxytype/typing-core/events/stats", () => ({
./frontend/__tests__/components/pages/test/result/ResultChart.spec.tsx:16:vi.mock("@oxytype/typing-core/events/stats", () => ({
./frontend/__tests__/queries/quote-ownership.spec.ts:2:import type { Quote } from "@oxytype/typing-core/quotes";
./frontend/__tests__/components/modals/event-log-viewer/video-sync.spec.ts:21:import type { TestEventNoMs } from "@oxytype/typing-core/events/types";
./frontend/__tests__/components/modals/event-log-viewer/timeline-lanes.spec.ts:18:} from "@oxytype/typing-core/events/types";
./frontend/__tests__/components/modals/event-log-viewer/scatter-points.spec.ts:15:import type { TestEventNoMs } from "@oxytype/typing-core/events/types";
./frontend/__tests__/components/modals/event-log-viewer/event-log.spec.ts:13:import type { TestEventNoMs } from "@oxytype/typing-core/events/types";
```

## Fixture readers

```text
packages/typing-core/README.md:72:`__fixtures__/keystrokes` contains raw input/timings, event logs and result
packages/typing-core/__test__/words-generator.spec.ts:126:  "../../__fixtures__/words",
backend/scripts/anticheat-calibrate.ts:25:  ["recorded-web", "packages/typing-core/__fixtures__/keystrokes"],
backend/scripts/anticheat-calibrate.ts:27:  ["", "packages/typing-core/__fixtures__/anticheat"],
packages/typing-core/__test__/fixtures.ts:11:  "../__fixtures__/keystrokes",
packages/typing-core/scripts/record-fixtures.ts:378:const outDir = join(here, "../__fixtures__/keystrokes");
packages/typing-core/scripts/record-bot-fixtures.ts:10: *   vp fmt packages/typing-core/__fixtures__/anticheat
packages/typing-core/scripts/record-bot-fixtures.ts:239:  "../__fixtures__/anticheat",
packages/typing-core/__test__/completed-event.spec.ts:28:  "../../__fixtures__/keystrokes",
backend/__tests__/anticheat/detectors.spec.ts:17:  "../../../packages/typing-core/__fixtures__",
frontend/__tests__/test/words-generator-parity.spec.ts:7:// (packages/typing-core/__fixtures__/words/cases.json) runs with a seeded
frontend/__tests__/test/words-generator-parity.spec.ts:105:  "../../../../packages/typing-core/__fixtures__/words",
frontend/__tests__/test/characterization/replay.spec.ts:36:      "../../../../../packages/typing-core/__fixtures__/keystrokes/words-10-errors.json",
frontend/__tests__/components/modals/LastSignedOutResultModal.spec.tsx:45:import fixture from "../../../../packages/typing-core/__fixtures__/keystrokes/words-10-clean.json";
```

## Browser rule paths

All six `frontend/src/ts/input/handlers/*.ts` require migration:
insertion overrides/normalization, deletion penalties, progression, finish/failure,
beforeinput gates/limits, confidence/freedom, code unindent, physical keys/modifiers.
Helpers `word-navigation`, `fail-or-finish`, `validation`, `util` also own rules.
Composition lifecycle, textarea sentinel, Firefox deletion, layout overflow, visible
word windows and key translation are host observations, explicitly supplied to Rust.

Other consumers: runtime initialization/test-logic/test-timer/completion.client,
words-generator, funbox hooks, pace, weak-spot, practice, today-tracker, replay,
result/chart-data/history/accuracy, event-log viewer and result components.

## Funboxes

Inventory identifiers/properties/forced config in `packages/funbox/src/list.ts`.
Rule hooks in `funbox-word-functions.ts` and `words-generator/funboxes.ts`;
browser hooks in runtime `funbox/funbox-functions.ts`.
Rule hooks move to Rust; visual/audio effects, fetch and notifications stay host.

## Reference provenance

SHA-256 of all current fixtures: `reference-manifest.json`. Never regenerate
snapshots/hashes to make a port pass. Existing backend anticheat consumers retained.


## Website destinations after Phase 2.3

| Consumer | Implemented destination |
| --- | --- |
| Browser input/deletion/composition/timing | `runtime/session.client.ts` → owned native BrowserSession; `input-projection.client.ts` renders deltas |
| Words/sections/custom/repeat/quote queue/catalog | `runtime/content.client.ts` → native BrowserContent; raw assets in `content-assets.client.ts` |
| Funbox rule hooks | Rust generator/transform/policy modules; browser registry contains visual/audio/platform hooks |
| Funbox eligibility/forced config | `policy.client.ts` → native policy queries |
| Restart/no quit/long-test/pace decisions | native session restart policy; web orchestrates animations/storage |
| Practice/weak-spot learning | native analysis/content owner; web retains practice UI/preferences |
| Defaults/themes/config metadata/migration/import order | `packages/web-shared/src` (SSR safe); engine defaults from Rust artifacts; browser injects native funbox policies |
| Completion/history/chart/replay playback | Phase 2.4 active; original consumers listed above remain until migrated |
| Remaining generic TS helpers/types | Phase 2.6 extraction/removal tracked; never keep legacy rule implementations as helpers |

Evidence: all 61 frozen frontend generators run actual optimized Wasm; 54 broad
built-site settings/command/modal/quote/restart checks; source/loading edge checks;
1,577 frontend units and six workerd SSR document cases. Historical consumer map
above records the original audit, not current imports.

## Website result destinations after Phase 2.4

- `features/typing/analysis.client.ts`: owned native result/inspector queries and
  mechanical UTF-16/infinite-burst projections; WeakMap caches immutable views.
- `runtime/completion.client.ts`: Rust validity/AFK/custom-progress decisions;
  existing account metadata, tags/challenges, storage/hash/submission preserved.
- Result history/chart/accuracy components and command palette consume that facade.
- `runtime/replay.ts`: native BrowserReplay mutates/seeks; route-owned timers/audio
  and existing result rendering retained. `replay-view.ts` contains DTO view types.
- Event-log viewer input/position/timing derives from native inspection; malformed
  loads fail in its existing error UI. Timeline/video/chart presentation stays TS.
- Old inspector reconstruction removed; its capture source preserved inertly under
  `typing-fixtures/provenance`. Remaining legacy engine utilities retire in 2.6.
