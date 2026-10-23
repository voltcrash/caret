import { describe, expect, it } from "vite-plus/test";
import {
  getActiveTypingSeconds,
  getLocalMidnight,
  TypingTimeTracker,
} from "../src/typing-time";

describe("typing time", () => {
  it("sums active seconds of complete and incomplete tests", () => {
    expect(
      getActiveTypingSeconds([
        { testDuration: 60, incompleteTestSeconds: 15, afkDuration: 5 },
        { testDuration: 30, incompleteTestSeconds: 0, afkDuration: 0 },
      ]),
    ).toBe(100);
  });

  it("finds local midnight", () => {
    expect(getLocalMidnight(new Date(2026, 9, 14, 15, 30, 12, 5))).toEqual(
      new Date(2026, 9, 14),
    );
  });

  it("counts the session until today's results load", () => {
    let now = new Date(2026, 9, 14, 12);
    const tracker = new TypingTimeTracker(() => now);
    tracker.add(30);
    expect(tracker.isToday()).toBe(false);
    tracker.loadToday([
      { testDuration: 10, incompleteTestSeconds: 0, afkDuration: 0 },
    ]);
    tracker.add(5);
    expect(tracker.getSeconds()).toBe(15);
    expect(tracker.isToday()).toBe(true);
    now = new Date(2026, 9, 15, 0, 1);
    tracker.add(10);
    tracker.add(5);
    expect(tracker.getSeconds()).toBe(15);
  });

  it("starts over when the month rolls over", () => {
    let now = new Date(2026, 9, 31, 23);
    const tracker = new TypingTimeTracker(() => now);
    tracker.loadToday([
      { testDuration: 10, incompleteTestSeconds: 0, afkDuration: 0 },
    ]);
    now = new Date(2026, 10, 1, 0, 1);
    tracker.add(10);
    expect(tracker.getSeconds()).toBe(10);
  });

  it("keeps counting the session across days before loading", () => {
    let now = new Date(2026, 9, 14, 23);
    const tracker = new TypingTimeTracker(() => now);
    tracker.add(10);
    now = new Date(2026, 9, 15, 1);
    tracker.add(10);
    expect(tracker.getSeconds()).toBe(20);
  });
});
