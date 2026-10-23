/** One-time capture of the original event-log inspector; refuses overwrite. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EventLog } from "../src/events/types";
import {
  getAccuracy,
  getKeypressDurations,
  getKeypressSpacing,
  getTimerBoundaryLabels,
} from "../src/events/stats";
import {
  inputsPerWord,
  getCurrentWordIndex,
} from "../../../frontend/src/ts/components/modals/event-log-viewer/event-log";
import { toEngineLog } from "../../typing-engine/src/text";
const directory = resolve(
  import.meta.dirname,
  "../../typing-fixtures/reference/keystrokes",
);
const cases = readdirSync(directory)
  .filter((name) => name.endsWith(".json"))
  .flatMap((name) => {
    const fixture = JSON.parse(
      readFileSync(resolve(directory, name), "utf8"),
    ) as { eventLog: EventLog };
    const log = fixture.eventLog;
    const indices = [
      ...new Set([
        -1,
        0,
        1,
        2,
        Math.floor(log.events.length / 3),
        Math.floor(log.events.length / 2),
        log.events.length - 2,
        log.events.length - 1,
      ]),
    ];
    return indices.map((index) => {
      const prefix = { ...log, events: log.events.slice(0, index + 1) };
      return {
        name: `${name}:${index}`,
        log: toEngineLog(prefix),
        expected: {
          accuracy: getAccuracy(prefix),
          keySpacing: getKeypressSpacing(prefix),
          keyDuration: getKeypressDurations(prefix),
          boundaryLabels: getTimerBoundaryLabels(prefix, false),
          inputs: inputsPerWord(prefix.events, log.context.targetWords.length),
          wordIndex: getCurrentWordIndex(prefix.events),
        },
      };
    });
  });
writeFileSync(
  resolve(directory, "../../oracle/inspection.json"),
  `${JSON.stringify(cases, null, 2)}\n`,
  { flag: "wx" },
);
console.log(`Captured ${cases.length} original inspector prefixes`);
