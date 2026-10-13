import { describe, it, expect } from "vite-plus/test";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { CompletedEvent } from "@oxytype/schemas/results";
import { Config } from "@oxytype/schemas/configs";
import { buildCompletedEvent } from "@oxytype/typing-core/completed-event";
import { hashResult } from "../../src/ts/utils/result-hash";
import { EventLog } from "@oxytype/typing-core/events/types";
import {
  getCorrectedWordsHistory,
  getIncompleteTestSeconds,
  getInputHistory,
  getKeypressesPerSecond,
  getMissedWords,
  getRawHistory,
  getWordBurstHistory,
} from "../../src/ts/test/events/stats";

// Parity harness for the typing-core extraction. The fixtures were recorded
// from the real web test (packages/typing-core/scripts/record-fixtures.ts).
// The frontend output is snapshotted next to them so typing-core can be
// checked against exactly what the web computes. Regenerate the snapshots
// with UPDATE_PARITY_SNAPSHOTS=1 - only when the web output is meant to change.

const FIXTURES_DIR = resolve(
  fileURLToPath(import.meta.url),
  "../../../../packages/typing-core/__fixtures__/keystrokes",
);

type KeystrokeFixture = {
  name: string;
  config: Pick<
    Config,
    | "mode"
    | "time"
    | "words"
    | "language"
    | "punctuation"
    | "numbers"
    | "lazyMode"
    | "funbox"
    | "difficulty"
    | "blindMode"
    | "stopOnError"
  >;
  eventLog: EventLog;
  completedEvent: Omit<CompletedEvent, "hash" | "uid">;
};

const fixtures = readdirSync(FIXTURES_DIR)
  .filter((file) => file.endsWith(".json"))
  .map(
    (file) =>
      JSON.parse(
        readFileSync(resolve(FIXTURES_DIR, file), "utf-8"),
      ) as KeystrokeFixture,
  );

function rebuild(
  fixture: KeystrokeFixture,
): Omit<CompletedEvent, "hash" | "uid"> {
  const recorded = fixture.completedEvent;
  return buildCompletedEvent(fixture.eventLog, {
    config: fixture.config,
    currentQuote:
      recorded.mode === "quote"
        ? { id: Number(recorded.mode2), group: recorded.quoteLength ?? -1 }
        : null,
    customText: recorded.customText,
    tags: recorded.tags ?? [],
    bailedOut: recorded.bailedOut,
    restartCount: recorded.restartCount,
    incompleteTests: recorded.incompleteTests,
    incompleteSeconds: recorded.incompleteTestSeconds,
    timestamp: recorded.timestamp,
  });
}

describe("typing-core parity fixtures", () => {
  it("has fixtures", () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  describe.each(fixtures.map((f) => [f.name, f] as const))(
    "%s",
    (name, fixture) => {
      it("rebuilds the completed event the web recorded", () => {
        expect(rebuild(fixture)).toEqual(fixture.completedEvent);
      });

      it("matches the frontend snapshot", async () => {
        const completedEvent = rebuild(fixture);
        const { eventLog } = fixture;
        const snapshot = {
          completedEvent,
          hash: await hashResult({ ...completedEvent, uid: "fixture-uid" }),
          derived: {
            inputHistory: getInputHistory(eventLog),
            missedWords: getMissedWords(eventLog),
            wordBurstHistory: getWordBurstHistory(eventLog),
            correctedWordsHistory: getCorrectedWordsHistory(eventLog),
            rawHistory: getRawHistory(eventLog),
            keypressesPerSecond: getKeypressesPerSecond(eventLog),
            incompleteTestSeconds: getIncompleteTestSeconds(eventLog),
          },
        };
        // compared as data, the files are reformatted by the formatter.
        // json round trip on purpose: drops undefined just like the file
        // oxlint-disable-next-line unicorn/prefer-structured-clone
        const actual = JSON.parse(JSON.stringify(snapshot)) as unknown;
        const file = resolve(FIXTURES_DIR, "__snapshots__", `${name}.json`);
        if (
          process.env["UPDATE_PARITY_SNAPSHOTS"] === "1" ||
          !existsSync(file)
        ) {
          writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
        }
        expect(actual).toEqual(JSON.parse(readFileSync(file, "utf-8")));
      });
    },
  );
});
