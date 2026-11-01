import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vite-plus/test";
import * as Audit from "@caret/typing-engine/audit.server";
import { EngineFailure } from "@caret/typing-engine/failure";
import type { ResultEventLog } from "@caret/contracts/results";
import type { CompletedEvent } from "@caret/schemas/results";
import { versions } from "@caret/typing-engine/versions";
import { verifyEventLog } from "../../src/anticheat/event-log";

const keystrokes = resolve(
  __dirname,
  "../../../packages/typing-fixtures/reference/keystrokes",
);
type Recording = { eventLog: unknown; completedEvent: CompletedEvent };
const recordings = readdirSync(keystrokes)
  .filter((file) => file.endsWith(".json"))
  .map((file) => ({
    ...(JSON.parse(readFileSync(join(keystrokes, file), "utf8")) as Recording),
    // after the spread: fixtures carry a descriptive name of their own
    name: file,
  }));

function encode(
  log: unknown,
  behaviorVersion = versions.behavior,
): ResultEventLog {
  return {
    behaviorVersion,
    log: gzipSync(JSON.stringify(log)).toString("base64"),
  };
}
const time15 = recordings.find((r) => r.name === "time-15.json") as Recording;

describe("event log verification", () => {
  it.each([false, true])(
    "retries a trapped audit once; persistent trap: %s",
    (persistent) => {
      const trapped = (): never => {
        throw new EngineFailure({
          code: "internal",
          message: "trap",
          recovery: [],
        });
      };
      const audit = Audit.serverAudit();
      const verify = vi.fn(audit.verify).mockImplementationOnce(trapped);
      if (persistent) verify.mockImplementationOnce(trapped);
      const getter = vi
        .spyOn(Audit, "serverAudit")
        .mockReturnValue({ ...audit, verify });
      const reset = vi.spyOn(Audit, "resetServerAudit");
      try {
        expect(
          verifyEventLog(time15.completedEvent, encode(time15.eventLog)),
        ).toEqual(
          persistent
            ? { kind: "unverifiable", reason: "engine-error" }
            : { kind: "verified" },
        );
        expect(verify).toHaveBeenCalledTimes(2);
        expect(reset).toHaveBeenCalledTimes(persistent ? 2 : 1);
      } finally {
        getter.mockRestore();
        reset.mockRestore();
      }
    },
  );
  it.each(recordings.map((r) => [r.name, r] as const))(
    "verifies the unchanged browser recording %s",
    (_, { eventLog, completedEvent }) => {
      expect(verifyEventLog(completedEvent, encode(eventLog))).toEqual({
        kind: "verified",
      });
    },
  );
  it("rejects metrics the log does not produce", () => {
    const edited = { ...time15.completedEvent, wpm: 250 };
    expect(verifyEventLog(edited, encode(time15.eventLog))).toEqual({
      kind: "mismatch",
      mismatches: [
        {
          field: "wpm",
          submitted: 250,
          replayed: time15.completedEvent.wpm,
        },
      ],
    });
  });
  it("logs key timeline lengths rather than whole timelines", () => {
    const spacing = time15.completedEvent.keySpacing as number[];
    const edited = { ...time15.completedEvent, keySpacing: spacing.slice(1) };
    expect(verifyEventLog(edited, encode(time15.eventLog))).toEqual({
      kind: "mismatch",
      mismatches: [
        {
          field: "keySpacing",
          submitted: { length: spacing.length - 1 },
          replayed: { length: spacing.length },
        },
      ],
    });
  });
  it("draws no conclusion from clients on other scoring rules", () => {
    const edited = { ...time15.completedEvent, wpm: 250 };
    expect(
      verifyEventLog(edited, encode(time15.eventLog, versions.behavior + 1)),
    ).toEqual({ kind: "unverifiable", reason: "other-behavior" });
  });
  it("draws no conclusion from unreadable logs", () => {
    const { completedEvent } = time15;
    expect(
      verifyEventLog(completedEvent, { behaviorVersion: 1, log: "AAAA" }),
    ).toEqual({ kind: "unverifiable", reason: "undecodable" });
    expect(verifyEventLog(completedEvent, encode({ version: 0 }))).toEqual({
      kind: "unverifiable",
      reason: "invalid-log",
    });
    expect(
      verifyEventLog(
        completedEvent,
        encode({ ...(time15.eventLog as object), version: 0 }),
      ),
    ).toEqual({ kind: "unverifiable", reason: "invalid-log" });
  });
  it("refuses to inflate a decompression bomb", () => {
    const bomb = {
      behaviorVersion: versions.behavior,
      log: gzipSync(Buffer.alloc(8 * 1024 * 1024, 32)).toString("base64"),
    };
    expect(bomb.log.length).toBeLessThan(64 * 1024);
    expect(verifyEventLog(time15.completedEvent, bomb)).toEqual({
      kind: "unverifiable",
      reason: "undecodable",
    });
  });
});
