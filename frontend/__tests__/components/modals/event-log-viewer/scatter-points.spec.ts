import { describe, expect, it } from "vite-plus/test";

import {
  getCharPositionPoints,
  getHoldFlightPoints,
  getIndexPoints,
  getInsertKeystrokes,
  getKeydownCodes,
  getLagPoints,
  getLognormalFit,
  getPerKeyPoints,
  keyLabel,
  percentileOf,
} from "../../../../src/ts/components/modals/event-log-viewer/scatter-points";
import type { TestEventNoMs } from "@oxytype/typing-core/events/types";

function keydown(testMs: number, code: string): TestEventNoMs {
  return { type: "keydown", testMs, data: { code } } as TestEventNoMs;
}

function input(
  testMs: number,
  inputType: string,
  charIndex: number,
  automatic?: true,
): TestEventNoMs {
  return {
    type: "input",
    testMs,
    data: {
      inputType,
      charIndex,
      wordIndex: 0,
      inputValue: "",
      automatic,
    },
  } as TestEventNoMs;
}

describe("keyLabel", () => {
  it("strips Key and Digit prefixes", () => {
    expect(keyLabel("KeyA")).toBe("A");
    expect(keyLabel("Digit7")).toBe("7");
  });

  it("uses symbols for named keys", () => {
    expect(keyLabel("Space")).toBe("␣");
    expect(keyLabel("Comma")).toBe(",");
  });

  it("falls back to the code", () => {
    expect(keyLabel("F5")).toBe("F5");
  });
});

describe("percentileOf", () => {
  it("picks the floor index percentile", () => {
    expect(percentileOf([5, 1, 3, 2, 4], 0.5)).toBe(3);
    expect(percentileOf([5, 1, 3, 2, 4], 0.95)).toBe(4);
  });

  it("is at least 1", () => {
    expect(percentileOf([0, 0, 0], 0.5)).toBe(1);
    expect(percentileOf([], 0.5)).toBe(1);
  });

  it("does not sort the input in place", () => {
    const values = [3, 1, 2];
    percentileOf(values, 0.5);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("event extraction", () => {
  it("collects keydown codes in order", () => {
    expect(
      getKeydownCodes([
        keydown(0, "KeyA"),
        input(1, "insertText", 0),
        keydown(2, "KeyB"),
      ]),
    ).toEqual(["KeyA", "KeyB"]);
  });

  it("keeps only real insert keystrokes", () => {
    expect(
      getInsertKeystrokes([
        input(0, "insertText", 0),
        input(5, "deleteContentBackward", 0),
        input(5, "insertText", 1, true),
        input(9, "insertText", 1),
      ]),
    ).toEqual([
      { testMs: 0, charIndex: 0 },
      { testMs: 9, charIndex: 1 },
    ]);
  });
});

describe("point builders", () => {
  it("pairs each gap with the next", () => {
    expect(getLagPoints([1, 2, 3])).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 3 },
    ]);
    expect(getLagPoints([1])).toEqual([]);
  });

  it("indexes gaps in order", () => {
    expect(getIndexPoints([10, 20])).toEqual([
      { x: 0, y: 10 },
      { x: 1, y: 20 },
    ]);
  });

  it("skips unreleased and missing holds", () => {
    expect(getHoldFlightPoints([100, 110, 120], [50, 0])).toEqual([
      { x: 100, y: 50 },
    ]);
  });

  it("measures time between inserts against char position", () => {
    expect(
      getCharPositionPoints([
        { testMs: 0, charIndex: 0 },
        { testMs: 100, charIndex: 1 },
        { testMs: 250, charIndex: 0 },
      ]),
    ).toEqual([
      { x: 1, y: 100 },
      { x: 0, y: 150 },
    ]);
  });
});

describe("getPerKeyPoints", () => {
  it("groups by key in keyboard order with a spread", () => {
    const codes = ["KeyS", "KeyA", "KeyS", "KeyA", "KeyS", "KeyA", "KeyQ"];
    const values = [1, 2, 3, 4, 5, 6, 7];
    const { labels, points } = getPerKeyPoints(values, codes);
    // KeyQ has under 3 presses, so it gets no column
    expect(labels).toEqual(["A", "S"]);
    expect(points.map((p) => p.y)).toEqual([2, 4, 6, 1, 3, 5]);
    expect(points.map((p) => p.x)).toEqual([
      -0.14,
      -0.07,
      0,
      1 - 0.14,
      1 - 0.07,
      1,
    ]);
  });

  it("drops non positive values", () => {
    const { labels } = getPerKeyPoints([0, 1, 1], ["KeyA", "KeyA", "KeyA"]);
    expect(labels).toEqual([]);
  });

  it("puts unknown keys last", () => {
    const codes = ["F1", "F1", "F1", "KeyA", "KeyA", "KeyA"];
    const { labels } = getPerKeyPoints([1, 1, 1, 1, 1, 1], codes);
    expect(labels).toEqual(["A", "F1"]);
  });
});

describe("getLognormalFit", () => {
  it("needs at least 5 values", () => {
    expect(getLognormalFit([1, 2, 3, 4])).toEqual({ points: [], sigma: null });
  });

  it("fits a constant sample exactly", () => {
    const fit = getLognormalFit([100, 100, 100, 100, 100]);
    expect(fit.sigma).toBe(0);
    for (const point of fit.points) {
      expect(point.x).toBeCloseTo(100);
      expect(point.y).toBe(100);
    }
  });

  it("returns sorted observations with ascending quantiles", () => {
    const fit = getLognormalFit([300, 100, 200, 150, 120, 0]);
    expect(fit.points.map((p) => p.y)).toEqual([100, 120, 150, 200, 300]);
    const xs = fit.points.map((p) => p.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(fit.sigma).toBeGreaterThan(0);
  });
});
