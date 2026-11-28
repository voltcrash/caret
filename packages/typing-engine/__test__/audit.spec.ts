import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vite-plus/test";
import { serverAudit, resetServerAudit } from "../src/audit.server";
import { EngineFailure } from "../src/failure";
import { toEngineLog, type WebLog } from "../src/text";
import { versions } from "../src/versions";

const recording = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../typing-fixtures/reference/keystrokes/time-15.json",
    ),
    "utf8",
  ),
) as { eventLog: WebLog; completedEvent: Record<string, unknown> };

it("replaces the audit instance without changing replay behavior", () => {
  const first = serverAudit();
  resetServerAudit();
  expect(serverAudit()).not.toBe(first);
  expect(
    serverAudit().verify(
      toEngineLog(recording.eventLog),
      recording.completedEvent,
      versions.behavior,
    ).mismatches,
  ).toEqual([]);
});

it("verifies a browser recording through the Node-compiled module", () => {
  const audit = serverAudit();
  const log = toEngineLog(recording.eventLog);
  expect(
    audit.verify(log, recording.completedEvent, versions.behavior).mismatches,
  ).toEqual([]);
  const edited = { ...recording.completedEvent, wpm: 250 };
  expect(
    audit.verify(log, edited, versions.behavior).mismatches.map((m) => m.field),
  ).toEqual(["wpm"]);
});
it("shares one instance and reports engine errors as EngineFailure", () => {
  expect(serverAudit()).toBe(serverAudit());
  const log = { ...toEngineLog(recording.eventLog), version: 0 };
  expect(() =>
    serverAudit().verify(log, recording.completedEvent, versions.behavior),
  ).toThrow(EngineFailure);
});
it("answers statistics and rule queries", () => {
  const audit = serverAudit();
  expect(audit.distribution([])).toBeNull();
  // floor((n - 1) * p) quantiles, as in the TypeScript original
  expect(audit.distribution([2, 4])?.p50).toBe(2);
  expect(audit.probit([0.5])).toEqual([0]);
  expect(audit.compatible(["nospace", "nospace"])).toBe(false);
  expect(
    audit.challenge(
      {
        wpm: 10,
        acc: 100,
        rawWpm: 10,
        consistency: 50,
        afkDuration: 0,
        testDuration: 60,
        funbox: [],
      },
      {},
      { wpm: { min: 20 } },
    ),
  ).toEqual(["WPM below 20"]);
});
it("skips comparison for clients on other scoring rules", () => {
  const log = toEngineLog(recording.eventLog);
  const edited = { ...recording.completedEvent, wpm: 250 };
  expect(serverAudit().verify(log, edited, versions.behavior + 1)).toEqual({
    sameBehavior: false,
    legacyLog: false,
    mismatches: [],
  });
});

it("marks v1 logs as legacy and v2 logs with bound modifiers as non-legacy", () => {
  const v1 = toEngineLog(recording.eventLog);
  expect(
    serverAudit().verify(v1, recording.completedEvent, versions.behavior),
  ).toEqual({
    sameBehavior: true,
    legacyLog: true,
    mismatches: [],
  });

  const v2 = {
    ...v1,
    version: versions.eventLog,
    context: {
      ...v1.context,
      punctuation: false,
      numbers: false,
      funbox: [],
      difficulty: "normal",
      language: "english",
      stopOnLetter: false,
    },
  };
  expect(
    serverAudit().verify(v2, recording.completedEvent, versions.behavior),
  ).toEqual({
    sameBehavior: true,
    legacyLog: false,
    mismatches: [],
  });
});
