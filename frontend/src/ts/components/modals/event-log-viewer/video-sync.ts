import type { Mark } from "../../../states/event-log-viewer";
import type { TestEventNoMs } from "@oxytype/web-shared/events/types";
import type { TimelineMark, VideoBar } from "./timeline-lanes";

/** eventIndex (index into the log's events) → mark id */
export type MarkAssignments = Record<number, string>;

/** videoMs = startEff + testMs * slope */
export type VideoMapping = { startEff: number; slope: number };

export type DriftPoint = {
  eventTestMs: number;
  driftMs: number;
  label: string;
};

export function identityMapping(): VideoMapping {
  return { startEff: 0, slope: 1 };
}

/**
 * Linear map from test time to video time, pinned by the two sync marks and
 * the events they are assigned to.
 */
export function computeVideoMapping(
  startMark: Mark,
  endMark: Mark,
  startEvent: TestEventNoMs,
  endEvent: TestEventNoMs,
): VideoMapping {
  const a = startEvent.testMs;
  const b = endEvent.testMs;
  if (b === a) return { startEff: startMark.videoMs, slope: 1 };
  const slope = (endMark.videoMs - startMark.videoMs) / (b - a);
  return { startEff: startMark.videoMs - a * slope, slope };
}

export function testMsToVideoMs(mapping: VideoMapping, testMs: number): number {
  return mapping.startEff + testMs * mapping.slope;
}

export function videoMsToTestMs(
  mapping: VideoMapping,
  videoMs: number,
): number {
  if (mapping.slope === 0) return 0;
  return (videoMs - mapping.startEff) / mapping.slope;
}

export function eventIndexForMark(
  assignments: MarkAssignments,
  id: string,
): number | undefined {
  for (const [k, v] of Object.entries(assignments)) {
    if (v === id) return Number(k);
  }
  return undefined;
}

/** assignments without any entry pointing at the mark */
export function unassignMark(
  assignments: MarkAssignments,
  id: string,
): MarkAssignments {
  const next: MarkAssignments = {};
  for (const [k, v] of Object.entries(assignments)) {
    if (v !== id) next[Number(k)] = v;
  }
  return next;
}

/**
 * Assigns the mark to the event, moving it off whatever event held it before.
 * A null mark clears the event.
 */
export function assignMark(
  assignments: MarkAssignments,
  eventIndex: number,
  markId: string | null,
): MarkAssignments {
  const next: MarkAssignments = {};
  for (const [k, v] of Object.entries(assignments)) {
    const ki = Number(k);
    if (ki === eventIndex) continue;
    if (markId !== null && v === markId) continue;
    next[ki] = v;
  }
  if (markId !== null) next[eventIndex] = markId;
  return next;
}

export function unassignedMarks(
  marks: Mark[],
  assignments: MarkAssignments,
): Mark[] {
  return marks.filter(
    (m) => eventIndexForMark(assignments, m.id) === undefined,
  );
}

/** marks an event can pick from: free ones plus its own */
export function marksForEvent(
  marks: Mark[],
  assignments: MarkAssignments,
  eventIndex: number,
): Mark[] {
  return marks.filter((m) => {
    const idx = eventIndexForMark(assignments, m.id);
    return idx === undefined || idx === eventIndex;
  });
}

export function getVideoBarRange(
  mapping: VideoMapping,
  durationMs: number,
): VideoBar {
  return {
    start: videoMsToTestMs(mapping, 0),
    end: videoMsToTestMs(mapping, durationMs),
  };
}

export function getTimelineMarks(
  marks: Mark[],
  mapping: VideoMapping,
): TimelineMark[] {
  return marks.map((m) => ({
    testMs: videoMsToTestMs(mapping, m.videoMs),
    label: m.sync ?? m.id,
    sync: m.sync,
  }));
}

/**
 * How far each generic mark lands from the event it is assigned to once mapped
 * through the sync marks, sorted by event time.
 */
export function getDriftPoints(
  marks: Mark[],
  assignments: MarkAssignments,
  events: TestEventNoMs[],
  mapping: VideoMapping,
): DriftPoint[] {
  const points: DriftPoint[] = [];
  for (const mark of marks) {
    if (mark.sync !== undefined) continue;
    const idx = eventIndexForMark(assignments, mark.id);
    if (idx === undefined) continue;
    const event = events[idx];
    if (event === undefined) continue;
    const mappedTestMs = videoMsToTestMs(mapping, mark.videoMs);
    points.push({
      eventTestMs: event.testMs,
      driftMs: mappedTestMs - event.testMs,
      label: mark.id,
    });
  }
  points.sort((a, b) => a.eventTestMs - b.eventTestMs);
  return points;
}

/** frame number at a media time for the detected frame rate */
export function getFrameIndex(frameTimeMs: number, fps: number): number {
  return Math.round((frameTimeMs / 1000) * fps);
}

/** median of the frame rate samples, undefined when there are none */
export function medianFps(samples: number[]): number | undefined {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Clamps a seek target into the video. An unknown (non finite) duration only
 * clamps at 0.
 */
export function clampVideoSeconds(seconds: number, duration: number): number {
  return Math.max(
    0,
    Math.min(Number.isFinite(duration) ? duration : seconds, seconds),
  );
}
