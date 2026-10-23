import { describe, expect, it } from "vite-plus/test";

import {
  buildLanes,
  getNextTimelineZoom,
  getTimelineMaxMs,
  getTimelineMinMs,
  TIMELINE_LANE_GAP,
  TIMELINE_MAX_ZOOM,
  TIMELINE_PADDING_MS,
  TIMELINE_TRACK_GAP,
  TIMELINE_TRACK_HEIGHT,
} from "../../../../src/ts/components/modals/event-log-viewer/timeline-lanes";
import { EVENT_TYPES } from "../../../../src/ts/states/event-log-viewer";
import type {
  TestEventNoMs,
  TestEventType,
} from "@oxytype/web-shared/events/types";

function key(
  type: "keydown" | "keyup",
  testMs: number,
  code: string,
): TestEventNoMs {
  return { type, testMs, data: { code } } as TestEventNoMs;
}

function input(testMs: number, inputType: string): TestEventNoMs {
  return {
    type: "input",
    testMs,
    data: { inputType, charIndex: 0, wordIndex: 0, inputValue: "" },
  } as TestEventNoMs;
}

const all = new Set<TestEventType>(EVENT_TYPES);

describe("buildLanes", () => {
  it("pairs keydown and keyup into bars", () => {
    const { segments } = buildLanes(
      [key("keydown", 0, "KeyA"), key("keyup", 50, "KeyA")],
      all,
    );
    expect(segments).toEqual([
      {
        start: 0,
        end: 50,
        kind: "bar",
        type: "keydown",
        label: "KeyA",
        topPx: 0,
      },
    ]);
  });

  it("stacks overlapping keys on separate tracks", () => {
    const { segments, totalHeight } = buildLanes(
      [
        key("keydown", 0, "KeyA"),
        key("keydown", 10, "KeyB"),
        key("keyup", 20, "KeyA"),
        key("keyup", 30, "KeyB"),
      ],
      all,
    );
    expect(segments.map((s) => s.topPx)).toEqual([
      0,
      TIMELINE_TRACK_HEIGHT + TIMELINE_TRACK_GAP,
    ]);
    expect(totalHeight).toBe(2 * TIMELINE_TRACK_HEIGHT + TIMELINE_TRACK_GAP);
  });

  it("reuses a track once the previous key ended", () => {
    const { segments } = buildLanes(
      [
        key("keydown", 0, "KeyA"),
        key("keyup", 5, "KeyA"),
        key("keydown", 10, "KeyB"),
        key("keyup", 20, "KeyB"),
      ],
      all,
    );
    expect(segments.map((s) => s.topPx)).toEqual([0, 0]);
  });

  it("draws an unmatched keyup as a dot in its own lane", () => {
    const { segments } = buildLanes([key("keyup", 5, "KeyA")], all);
    expect(segments).toEqual([
      {
        start: 5,
        end: 5,
        kind: "dot",
        type: "keyup",
        label: "KeyA",
        topPx: 0,
      },
    ]);
  });

  it("draws a never released keydown as a dot", () => {
    const { segments } = buildLanes([key("keydown", 7, "KeyA")], all);
    expect(segments[0]).toMatchObject({ kind: "dot", start: 7, end: 7 });
  });

  it("draws keys as dots when only one side is visible", () => {
    const { segments } = buildLanes(
      [key("keydown", 0, "KeyA"), key("keyup", 50, "KeyA")],
      new Set<TestEventType>(["keyup"]),
    );
    expect(segments).toEqual([
      {
        start: 50,
        end: 50,
        kind: "dot",
        type: "keyup",
        label: "KeyA",
        topPx: 0,
      },
    ]);
  });

  it("colours delete inputs as errors", () => {
    const { segments } = buildLanes(
      [input(0, "insertText"), input(1, "deleteContentBackward")],
      all,
    );
    expect(segments.map((s) => s.bg)).toEqual([undefined, "bg-error"]);
  });

  it("separates lanes with a gap", () => {
    const { segments, totalHeight } = buildLanes(
      [input(0, "insertText"), key("keyup", 1, "KeyA")],
      all,
    );
    const keyup = segments.find((s) => s.type === "keyup");
    expect(keyup?.topPx).toBe(TIMELINE_TRACK_HEIGHT + TIMELINE_LANE_GAP);
    expect(totalHeight).toBe(2 * TIMELINE_TRACK_HEIGHT + TIMELINE_LANE_GAP);
  });

  it("skips hidden types and keeps a minimum height", () => {
    const { segments, totalHeight } = buildLanes(
      [input(0, "insertText")],
      new Set<TestEventType>(["timer"]),
    );
    expect(segments).toEqual([]);
    expect(totalHeight).toBe(TIMELINE_TRACK_HEIGHT);
  });
});

describe("timeline bounds", () => {
  it("pads the test range", () => {
    expect(getTimelineMinMs(undefined)).toBe(-TIMELINE_PADDING_MS);
    expect(getTimelineMaxMs(1000, undefined)).toBe(1000 + TIMELINE_PADDING_MS);
  });

  it("widens to fit the video", () => {
    const bar = { start: -500, end: 2000 };
    expect(getTimelineMinMs(bar)).toBe(-500 - TIMELINE_PADDING_MS);
    expect(getTimelineMaxMs(1000, bar)).toBe(2000 + TIMELINE_PADDING_MS);
  });

  it("does not shrink for a video inside the test", () => {
    const bar = { start: 100, end: 200 };
    expect(getTimelineMinMs(bar)).toBe(-TIMELINE_PADDING_MS);
    expect(getTimelineMaxMs(1000, bar)).toBe(1000 + TIMELINE_PADDING_MS);
  });
});

describe("getNextTimelineZoom", () => {
  it("zooms in on scroll up and out on scroll down", () => {
    expect(getNextTimelineZoom(2, -1)).toBeCloseTo(2.4);
    expect(getNextTimelineZoom(2.4, 1)).toBeCloseTo(2);
  });

  it("clamps to the zoom range", () => {
    expect(getNextTimelineZoom(1, 1)).toBe(1);
    expect(getNextTimelineZoom(TIMELINE_MAX_ZOOM, -1)).toBe(TIMELINE_MAX_ZOOM);
  });
});
