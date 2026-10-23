import { describe, expect, it, vi } from "vite-plus/test";
import type { CompletedEvent } from "@oxytype/schemas/results";
import { completedEvent } from "../../../../backend/__tests__/__testData__/completed-event";
import { humanTimings } from "../../../../backend/__tests__/__testData__/key-timings";
import {
  getResultFailure,
  getKeyDataFailure,
  getBotFailure,
  getTimingFingerprint,
  getTimingReview,
} from "../../../../backend/src/anticheat";
import type { EventLog, TestEventNoMs } from "@oxytype/web-shared/events/types";
import "../../__harness__/native-engine";
import { analyzeLog } from "@oxytype/typing-engine/browser.client";
import { toEngineLog } from "@oxytype/typing-engine/text";

vi.mock("../../../src/ts/config/store", () => ({
  getMutableConfig: (() => {
    const storedConfig = { mode: "time", funbox: [] };
    return () => storedConfig;
  })(),
}));

function eventLog(
  options: {
    preStart?: boolean;
    coarsened?: boolean;
    ime?: boolean;
    mode?: "zen" | "time";
    bailout?: boolean;
  } = {},
): EventLog {
  const text = "a".repeat(220);
  const events: TestEventNoMs[] = [
    { type: "timer", testMs: 0, data: { event: "start", timer: 0, date: 0 } },
  ];
  let time = 0;
  for (let i = 0; i < text.length; i++) {
    const down = i === 0 && options.preStart ? -16_000 : time;
    const stamp = options.coarsened ? Math.round(time / 100) * 100 : time;
    if (!options.ime) {
      events.push({
        type: "keydown",
        testMs: options.coarsened ? stamp : down,
        data: { code: "KeyA" },
      });
      events.push({
        type: "keyup",
        testMs: stamp + (options.coarsened ? 100 : 40 + (i % 7) * 5),
        data: { code: "KeyA" },
      });
    }
    events.push({
      type: "input",
      testMs: stamp,
      data: {
        inputType: options.ime ? "insertCompositionText" : "insertText",
        data: "a",
        correct: true,
        wordIndex: 0,
        charIndex: i,
        inputValue: text.slice(0, i + 1),
      },
    });
    time += 100 + (i % 11) * 5;
  }
  const end = options.bailout ? time + 300 : 30_000;
  for (let tick = 1; tick * 1000 < end; tick++) {
    events.push({
      type: "timer",
      testMs: tick * 1000,
      data: { event: "step", timer: tick },
    });
  }
  events.push({
    type: "timer",
    testMs: end,
    data: { event: "end", timer: Math.floor(end / 1000), date: end },
  });
  events.sort((a, b) => a.testMs - b.testMs);
  return {
    version: 1,
    context: {
      targetWords: [text],
      mode: options.mode ?? "time",
      mode2: "30",
      bailedOut: options.bailout ?? false,
      koreanStatus: false,
    },
    events,
  };
}

/** A log replaying the given gaps and holds, rolling over where holds overlap. */
function timedEventLog(gaps: number[], holds: number[]): EventLog {
  const events: TestEventNoMs[] = [
    { type: "timer", testMs: 0, data: { event: "start", timer: 0, date: 0 } },
  ];
  const text = "a".repeat(holds.length);
  let time = 0;
  for (let i = 0; i < holds.length; i++) {
    // alternate codes so a hold outlasting the next gap is real rollover
    const code = i % 2 === 0 ? "KeyA" : "KeyS";
    events.push({ type: "keydown", testMs: time, data: { code } });
    events.push({
      type: "keyup",
      testMs: time + (holds[i] ?? 0),
      data: { code },
    });
    events.push({
      type: "input",
      testMs: time,
      data: {
        inputType: "insertText",
        data: "a",
        correct: true,
        wordIndex: 0,
        charIndex: i,
        inputValue: text.slice(0, i + 1),
      },
    });
    time += gaps[i] ?? 0;
  }
  const end = Math.ceil((time + 500) / 1000) * 1000;
  for (let tick = 1; tick * 1000 < end; tick++) {
    events.push({
      type: "timer",
      testMs: tick * 1000,
      data: { event: "step", timer: tick },
    });
  }
  events.push({
    type: "timer",
    testMs: end,
    data: { event: "end", timer: end / 1000, date: end },
  });
  events.sort((a, b) => a.testMs - b.testMs);
  return {
    version: 1,
    context: {
      targetWords: [text],
      mode: "time",
      mode2: String(end / 1000),
      bailedOut: false,
      koreanStatus: false,
    },
    events,
  };
}

/** Build from the real client event reducers, not backend validator helpers. */
function payload(log: EventLog): CompletedEvent {
  const { summary } = analyzeLog(toEngineLog(log), {
    op: "stats",
    now: 0,
  }).stats;
  return completedEvent({
    ...summary,
    mode: log.context.mode,
    mode2: log.context.mode2,
    bailedOut: log.context.bailedOut,
  });
}

describe("client events satisfy server anticheat", () => {
  it.each([
    {},
    { preStart: true },
    { coarsened: true },
    { ime: true },
    { bailout: true },
    { mode: "zen" },
  ] satisfies Parameters<typeof eventLog>[0][])(
    "accepts client telemetry for %j",
    (options) => {
      const result = payload(eventLog(options));
      expect(getResultFailure(result)).toBeUndefined();
      expect(getKeyDataFailure(result)).toBeUndefined();
      expect(getBotFailure(result)).toBeUndefined();
    },
  );
  it("raises no review signal for modelled human timing from client reducers", () => {
    const { keySpacing, keyDuration } = humanTimings(300, 11);
    const result = payload(timedEventLog(keySpacing, keyDuration));
    expect(getResultFailure(result)).toBeUndefined();
    expect(getKeyDataFailure(result)).toBeUndefined();
    expect(getTimingReview(result)?.signals).toEqual([]);
    expect(getTimingFingerprint(result)).toBeDefined();
  });
  it("leaves IME results without keyboard telemetry unreviewed", () => {
    const result = payload(eventLog({ ime: true }));
    expect(getTimingReview(result)).toBeUndefined();
    expect(getTimingFingerprint(result)).toBeUndefined();
  });
  it("detects score tampering after a genuine client payload is built", () => {
    const result = payload(eventLog());
    expect(getResultFailure({ ...result, wpm: result.wpm + 10 })).toBe(
      "score-mismatch",
    );
  });
});
