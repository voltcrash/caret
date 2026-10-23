import { describe, expect, it } from "vite-plus/test";

import {
  assignMark,
  clampVideoSeconds,
  computeVideoMapping,
  eventIndexForMark,
  getDriftPoints,
  getFrameIndex,
  getTimelineMarks,
  getVideoBarRange,
  identityMapping,
  marksForEvent,
  medianFps,
  testMsToVideoMs,
  unassignedMarks,
  unassignMark,
  videoMsToTestMs,
} from "../../../../src/ts/components/modals/event-log-viewer/video-sync";
import type { Mark } from "../../../../src/ts/states/event-log-viewer";
import type { TestEventNoMs } from "@oxytype/web-shared/events/types";

function event(testMs: number): TestEventNoMs {
  return { type: "keydown", testMs, data: { code: "KeyA" } };
}

const start: Mark = { id: "mark-1", videoMs: 1000, sync: "start" };
const end: Mark = { id: "mark-2", videoMs: 3000, sync: "end" };

describe("video mapping", () => {
  it("is the identity by default", () => {
    const mapping = identityMapping();
    expect(testMsToVideoMs(mapping, 123)).toBe(123);
    expect(videoMsToTestMs(mapping, 123)).toBe(123);
  });

  it("maps through the two sync marks", () => {
    // test 0..1000ms spans video 1000..3000ms, so the video runs at 2x
    const mapping = computeVideoMapping(start, end, event(0), event(1000));
    expect(mapping).toEqual({ startEff: 1000, slope: 2 });
    expect(testMsToVideoMs(mapping, 500)).toBe(2000);
    expect(videoMsToTestMs(mapping, 2000)).toBe(500);
  });

  it("round trips", () => {
    const mapping = computeVideoMapping(start, end, event(200), event(900));
    expect(videoMsToTestMs(mapping, testMsToVideoMs(mapping, 437))).toBeCloseTo(
      437,
    );
  });

  it("falls back to slope 1 when both events share a time", () => {
    expect(computeVideoMapping(start, end, event(5), event(5))).toEqual({
      startEff: 1000,
      slope: 1,
    });
  });

  it("maps everything to 0 for a flat slope", () => {
    expect(videoMsToTestMs({ startEff: 10, slope: 0 }, 500)).toBe(0);
  });

  it("places the video bar and marks on the test timeline", () => {
    const mapping = { startEff: 1000, slope: 2 };
    expect(getVideoBarRange(mapping, 5000)).toEqual({ start: -500, end: 2000 });
    expect(
      getTimelineMarks([start, { id: "mark-3", videoMs: 2000 }], mapping),
    ).toEqual([
      { testMs: 0, label: "start", sync: "start" },
      { testMs: 500, label: "mark-3", sync: undefined },
    ]);
  });
});

describe("mark assignments", () => {
  it("finds the event a mark is assigned to", () => {
    expect(eventIndexForMark({ 3: "a", 7: "b" }, "b")).toBe(7);
    expect(eventIndexForMark({ 3: "a" }, "b")).toBeUndefined();
  });

  it("unassigns a mark", () => {
    expect(unassignMark({ 3: "a", 7: "b" }, "a")).toEqual({ 7: "b" });
  });

  it("moves a mark to a new event", () => {
    expect(assignMark({ 3: "a", 7: "b" }, 5, "a")).toEqual({ 5: "a", 7: "b" });
  });

  it("replaces the mark already on the event", () => {
    expect(assignMark({ 3: "a", 7: "b" }, 7, "c")).toEqual({ 3: "a", 7: "c" });
  });

  it("clears an event with null", () => {
    expect(assignMark({ 3: "a", 7: "b" }, 7, null)).toEqual({ 3: "a" });
  });

  it("does not mutate the input", () => {
    const assignments = { 3: "a" };
    assignMark(assignments, 4, "a");
    unassignMark(assignments, "a");
    expect(assignments).toEqual({ 3: "a" });
  });

  it("lists free marks and the ones an event can pick", () => {
    const marks: Mark[] = [
      { id: "a", videoMs: 0 },
      { id: "b", videoMs: 0 },
      { id: "c", videoMs: 0 },
    ];
    const assignments = { 1: "a", 2: "b" };
    expect(unassignedMarks(marks, assignments).map((m) => m.id)).toEqual(["c"]);
    expect(marksForEvent(marks, assignments, 2).map((m) => m.id)).toEqual([
      "b",
      "c",
    ]);
  });
});

describe("getDriftPoints", () => {
  it("measures generic marks against their events, sorted by time", () => {
    const mapping = { startEff: 0, slope: 1 };
    const events = [event(100), event(50)];
    const marks: Mark[] = [
      start,
      { id: "a", videoMs: 103 },
      { id: "b", videoMs: 45 },
      { id: "unassigned", videoMs: 0 },
      { id: "missing", videoMs: 0 },
    ];
    const assignments = { 0: "a", 1: "b", 2: "start", 9: "missing" };
    expect(getDriftPoints(marks, assignments, events, mapping)).toEqual([
      { eventTestMs: 50, driftMs: -5, label: "b" },
      { eventTestMs: 100, driftMs: 3, label: "a" },
    ]);
  });
});

describe("frame helpers", () => {
  it("computes the frame index", () => {
    expect(getFrameIndex(1000, 30)).toBe(30);
    expect(getFrameIndex(1016, 60)).toBe(61);
  });

  it("takes the upper median of fps samples", () => {
    expect(medianFps([60, 30, 59])).toBe(59);
    expect(medianFps([30, 60])).toBe(60);
    expect(medianFps([])).toBeUndefined();
  });

  it("clamps seeks into the video", () => {
    expect(clampVideoSeconds(-1, 10)).toBe(0);
    expect(clampVideoSeconds(11, 10)).toBe(10);
    expect(clampVideoSeconds(5, 10)).toBe(5);
    expect(clampVideoSeconds(50, Number.NaN)).toBe(50);
  });
});
