import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadParityCases } from "../__test__/fixtures";
import type { EventLog } from "../src/events/types";
import { getAccuracy, getChars, getWordBurst } from "../src/events/stats";
const references = loadParityCases().map(({ name, fixture }) => {
  const log = fixture.eventLog as EventLog;
  const frames = [];
  for (let length = 0; length <= log.events.length; length++) {
    const prefix = { ...log, events: log.events.slice(0, length) };
    const indices = [
      ...new Set(
        prefix.events.flatMap((event) =>
          "wordIndex" in event.data ? [event.data.wordIndex] : [],
        ),
      ),
    ];
    const now = (prefix.events.at(-1)?.testMs ?? 0) + 10;
    frames.push({
      length,
      now,
      chars: getChars(prefix, true),
      accuracy: getAccuracy(prefix).percentage,
      bursts: indices.map((index) => [index, getWordBurst(prefix, index, now)]),
    });
  }
  return { name, frames };
});
writeFileSync(
  resolve(import.meta.dirname, "../../typing-fixtures/oracle/live-stats.json"),
  `${JSON.stringify(references)}\n`,
  { flag: "wx" },
);
