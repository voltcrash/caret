import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vite-plus/test";
import { serverAudit } from "@oxytype/typing-engine/audit.server";
import { toEngineLog, type WebLog } from "@oxytype/typing-engine/text";
import { versions } from "@oxytype/typing-engine/versions";
import { encodeEventLog } from "../../../src/features/typing/runtime/event-log-transport";

const recording = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../../../packages/typing-fixtures/reference/keystrokes/time-15.json",
    ),
    "utf8",
  ),
) as { eventLog: WebLog; completedEvent: Record<string, unknown> };

it("encodes a log the server replays to the same result", async () => {
  const encoded = await encodeEventLog(
    recording.eventLog,
    recording.completedEvent,
  );
  expect(encoded?.behaviorVersion).toBe(versions.behavior);
  const decoded = JSON.parse(
    gunzipSync(Buffer.from(encoded?.log ?? "", "base64")).toString("utf8"),
  ) as WebLog;
  expect(decoded).toEqual(recording.eventLog);
  expect(
    serverAudit().verify(
      toEngineLog(decoded),
      recording.completedEvent,
      versions.behavior,
    ).mismatches,
  ).toEqual([]);
});

it("omits logs that would not fit beside the result", async () => {
  // incompressible text, as long as a very long test
  const words = Array.from({ length: 20_000 }, (_, i) =>
    Math.sin(i).toString(36).slice(2),
  );
  const huge = {
    ...recording.eventLog,
    context: { ...recording.eventLog.context, targetWords: words },
  };
  expect(await encodeEventLog(huge, recording.completedEvent)).toBeUndefined();
  const bulky = { ...recording.completedEvent, padding: "x".repeat(97 * 1024) };
  expect(await encodeEventLog(recording.eventLog, bulky)).toBeUndefined();
});
