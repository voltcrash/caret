import { describe, expect, it } from "vite-plus/test";

import {
  getCurrentEventIndex,
  getMaxTestMs,
  getNextEventMs,
  getPreviousEventMs,
  parseContext,
  visualizeWhitespace,
} from "../../../../src/ts/components/modals/event-log-viewer/event-log";
import type { TestEventNoMs } from "@oxytype/typing-core/events/types";

function keydown(testMs: number, code = "KeyA"): TestEventNoMs {
  return { type: "keydown", testMs, data: { code } } as TestEventNoMs;
}

const validLog = {
  version: 1,
  events: [],
  context: { targetWords: ["hello"] },
};

describe("parseContext", () => {
  it("returns a valid log", () => {
    const log = parseContext(JSON.stringify(validLog));
    expect(log.context.targetWords).toEqual(["hello"]);
  });

  it("rejects non objects", () => {
    expect(() => parseContext("null")).toThrow("Expected an EventLog object");
    expect(() => parseContext("3")).toThrow("Expected an EventLog object");
  });

  it("rejects missing fields", () => {
    expect(() => parseContext(JSON.stringify({ version: 1 }))).toThrow(
      "Expected EventLog { version: 1, events, context }",
    );
  });

  it("rejects other versions", () => {
    expect(() =>
      parseContext(JSON.stringify({ ...validLog, version: 2 })),
    ).toThrow("Unsupported EventLog version 2 (expected 1)");
  });

  it("rejects non array events", () => {
    expect(() =>
      parseContext(JSON.stringify({ ...validLog, events: {} })),
    ).toThrow("EventLog.events must be an array");
  });

  it("rejects missing target words", () => {
    expect(() =>
      parseContext(JSON.stringify({ ...validLog, context: {} })),
    ).toThrow("EventLog.context.targetWords must be a string array");
    expect(() =>
      parseContext(JSON.stringify({ ...validLog, context: null })),
    ).toThrow("EventLog.context.targetWords must be a string array");
  });

  it("throws on invalid json", () => {
    expect(() => parseContext("{")).toThrow();
  });
});

describe("visualizeWhitespace", () => {
  it("replaces space, tab and newline", () => {
    expect(visualizeWhitespace("a b\tc\nd")).toBe("a␣b→c↵d");
  });

  it("leaves other text alone", () => {
    expect(visualizeWhitespace("abc")).toBe("abc");
  });
});

describe("getMaxTestMs", () => {
  it("returns the ceiling of the latest testMs", () => {
    expect(getMaxTestMs([keydown(10.2), keydown(5)])).toBe(11);
  });

  it("returns 0 for an empty log", () => {
    expect(getMaxTestMs([])).toBe(0);
  });
});

describe("getCurrentEventIndex", () => {
  const events = [keydown(0), keydown(10), keydown(10), keydown(20)];

  it("returns the latest event at or before the time", () => {
    expect(getCurrentEventIndex(events, 15)).toBe(1);
    expect(getCurrentEventIndex(events, 20)).toBe(3);
  });

  it("keeps the first of tied events", () => {
    expect(getCurrentEventIndex(events, 10)).toBe(1);
  });

  it("returns -1 before the first event", () => {
    expect(getCurrentEventIndex(events, -1)).toBe(-1);
  });
});

describe("getNextEventMs / getPreviousEventMs", () => {
  const events = [keydown(20), keydown(0), keydown(10)];

  it("finds the next event strictly after", () => {
    expect(getNextEventMs(events, 0)).toBe(10);
    expect(getNextEventMs(events, 5)).toBe(10);
    expect(getNextEventMs(events, 20)).toBeNull();
  });

  it("finds the previous event strictly before", () => {
    expect(getPreviousEventMs(events, 20)).toBe(10);
    expect(getPreviousEventMs(events, 15)).toBe(10);
    expect(getPreviousEventMs(events, 0)).toBeNull();
  });
});
