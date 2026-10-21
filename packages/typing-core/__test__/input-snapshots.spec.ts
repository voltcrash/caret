import { describe, expect, it } from "vite-plus/test";
import { createEventRecorder } from "../src/events/data";
import { createLiveCache } from "../src/events/live-cache";
import { getEventsForWord, getInputFromDom } from "../src/events/helpers";
import type { InputEventData } from "../src/events/types";

function fixture(): {
  recorder: ReturnType<typeof createEventRecorder>;
  input: (
    ms: number,
    wordIndex: number,
    inputValue: string,
    extra?: Partial<InputEventData>,
  ) => void;
} {
  const recorder = createEventRecorder({
    getActiveWordIndex: () => 0,
    liveCache: createLiveCache(),
  });
  const input = (
    ms: number,
    wordIndex: number,
    inputValue: string,
    extra: Partial<InputEventData> = {},
  ): void =>
    recorder.logTestEvent("input", ms, {
      inputType: "insertText",
      wordIndex,
      charIndex: 0,
      data: inputValue,
      correct: true,
      inputValue,
      ...extra,
    });
  return { recorder, input };
}

describe("per-word input snapshots", () => {
  it("matches sorted event-log reads through corrections, backtracking and ties", () => {
    const { recorder, input } = fixture();
    for (const [ms, index, value] of [
      [1, 0, "a"],
      [2, 0, "ax"],
      [3, 1, "b"],
      [4, 0, "a"],
      [5, 0, "abc"],
      [4, 0, "older"],
      [5, 0, "tie"],
      [6, 1, ""],
    ] as const) {
      input(ms, index, value);
      for (const wordIndex of [0, 1, 2]) {
        expect(recorder.getInputForWord(wordIndex)).toBe(
          getInputFromDom(
            getEventsForWord(recorder.getAllTestEvents(), wordIndex),
          ),
        );
      }
    }
  });

  it("retains incorrect last-word commit trimming", () => {
    const { recorder, input } = fixture();
    input(1, 0, "wrong ", {
      data: " ",
      lastWord: true,
      commitsWord: true,
      correct: false,
    });
    expect(recorder.getInputForWord(0)).toBe("wrong");
  });

  it("rebuilds snapshots after post-end cleanup and clears them on reset", () => {
    const { recorder, input } = fixture();
    recorder.logTestEvent("timer", 0, { event: "start", timer: 0, date: 0 });
    input(1, 0, "kept");
    recorder.logTestEvent("timer", 2, { event: "end", timer: 0, date: 2 });
    input(3, 0, "discarded");
    input(4, 1, "discarded");
    recorder.cleanupData();
    expect(recorder.getInputForWord(0)).toBe("kept");
    expect(recorder.getInputForWord(1)).toBe("");
    recorder.resetTestEvents();
    expect(recorder.getInputForWord(0)).toBe("");
    input(1, 0, "new test");
    expect(recorder.getInputForWord(0)).toBe("new test");
  });
});
