import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vite-plus/test";
import { serverAudit } from "../src/audit.server";
import { EngineFailure } from "../src/failure";
import { toEngineLog, type WebLog } from "../src/text";

const recording = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../typing-fixtures/reference/keystrokes/time-15.json",
    ),
    "utf8",
  ),
) as { eventLog: WebLog; completedEvent: Record<string, unknown> };

it("verifies a browser recording through the Node-compiled module", () => {
  const audit = serverAudit();
  const log = toEngineLog(recording.eventLog);
  expect(audit.verify(log, recording.completedEvent).mismatches).toEqual([]);
  const edited = { ...recording.completedEvent, wpm: 250 };
  expect(audit.verify(log, edited).mismatches.map((m) => m.field)).toEqual([
    "wpm",
  ]);
});
it("shares one instance and reports engine errors as EngineFailure", () => {
  expect(serverAudit()).toBe(serverAudit());
  const log = { ...toEngineLog(recording.eventLog), version: 0 };
  expect(() => serverAudit().verify(log, recording.completedEvent)).toThrow(
    EngineFailure,
  );
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
