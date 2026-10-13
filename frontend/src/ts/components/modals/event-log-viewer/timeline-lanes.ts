import type { SyncKind } from "../../../states/event-log-viewer";
import type { TestEventNoMs, TestEventType } from "../../../test/events/types";

import { EVENT_TYPES } from "../../../states/event-log-viewer";

export const TIMELINE_TRACK_HEIGHT = 8;
export const TIMELINE_TRACK_GAP = 2;
export const TIMELINE_LANE_GAP = 6;
export const TIMELINE_PADDING_MS = 125;
// enough to separate events a fraction of a millisecond apart - a 60s test at
// this zoom is roughly 0.06ms per pixel
export const TIMELINE_MAX_ZOOM = 1000;

export type TimelineSegment = {
  start: number;
  end: number;
  kind: "bar" | "dot";
  type: TestEventType;
  label?: string;
  topPx: number;
  bg?: string;
};

type RawSegment = Omit<TimelineSegment, "topPx">;

/** where the loaded video sits on the test timeline, in testMs */
export type VideoBar = { start: number; end: number };

export type TimelineMark = { testMs: number; label: string; sync?: SyncKind };

export function buildLanes(
  events: TestEventNoMs[],
  visible: Set<TestEventType>,
): { segments: TimelineSegment[]; totalHeight: number } {
  const byType = new Map<TestEventType, RawSegment[]>();
  for (const t of EVENT_TYPES) byType.set(t, []);

  const pairKeys = visible.has("keydown") && visible.has("keyup");
  const pendingDown = new Map<string, number>();

  for (const e of events) {
    if (e.type === "keydown") {
      if (pairKeys) {
        pendingDown.set(e.data.code, e.testMs);
      } else if (visible.has("keydown")) {
        byType.get("keydown")?.push({
          start: e.testMs,
          end: e.testMs,
          kind: "dot",
          type: "keydown",
          label: e.data.code,
        });
      }
    } else if (e.type === "keyup") {
      if (pairKeys) {
        const start = pendingDown.get(e.data.code);
        if (start !== undefined) {
          byType.get("keydown")?.push({
            start,
            end: e.testMs,
            kind: "bar",
            type: "keydown",
            label: e.data.code,
          });
          pendingDown.delete(e.data.code);
        } else {
          byType.get("keyup")?.push({
            start: e.testMs,
            end: e.testMs,
            kind: "dot",
            type: "keyup",
            label: e.data.code,
          });
        }
      } else if (visible.has("keyup")) {
        byType.get("keyup")?.push({
          start: e.testMs,
          end: e.testMs,
          kind: "dot",
          type: "keyup",
          label: e.data.code,
        });
      }
    } else if (visible.has(e.type)) {
      const seg: RawSegment = {
        start: e.testMs,
        end: e.testMs,
        kind: "dot",
        type: e.type,
      };
      if (e.type === "input" && e.data.inputType.startsWith("delete")) {
        seg.bg = "bg-error";
      }
      byType.get(e.type)?.push(seg);
    }
  }

  if (pairKeys) {
    for (const [code, start] of pendingDown) {
      byType.get("keydown")?.push({
        start,
        end: start,
        kind: "dot",
        type: "keydown",
        label: code,
      });
    }
  }

  const segments: TimelineSegment[] = [];
  let y = 0;
  let firstLane = true;

  for (const t of EVENT_TYPES) {
    const segs = byType.get(t) ?? [];
    if (segs.length === 0) continue;
    if (!firstLane) y += TIMELINE_LANE_GAP;
    firstLane = false;

    const sorted = [...segs].sort((a, b) => a.start - b.start);
    let tracksUsed = 1;

    if (t === "keydown") {
      const trackEnds: number[] = [];
      for (const seg of sorted) {
        let track = trackEnds.findIndex((end) => end < seg.start);
        if (track === -1) {
          track = trackEnds.length;
          trackEnds.push(seg.end);
        } else {
          trackEnds[track] = seg.end;
        }
        segments.push({
          ...seg,
          topPx: y + track * (TIMELINE_TRACK_HEIGHT + TIMELINE_TRACK_GAP),
        });
      }
      tracksUsed = Math.max(1, trackEnds.length);
    } else {
      for (const seg of sorted) {
        segments.push({ ...seg, topPx: y });
      }
    }

    y +=
      tracksUsed * TIMELINE_TRACK_HEIGHT +
      (tracksUsed - 1) * TIMELINE_TRACK_GAP;
  }

  return { segments, totalHeight: Math.max(y, TIMELINE_TRACK_HEIGHT) };
}

/** timeline start, widened to fit the video when it starts before the test */
export function getTimelineMinMs(videoBar: VideoBar | undefined): number {
  let min = -TIMELINE_PADDING_MS;
  if (videoBar !== undefined) {
    min = Math.min(min, videoBar.start - TIMELINE_PADDING_MS);
  }
  return min;
}

/** timeline end, widened to fit the video when it runs past the test */
export function getTimelineMaxMs(
  maxMs: number,
  videoBar: VideoBar | undefined,
): number {
  let max = maxMs + TIMELINE_PADDING_MS;
  if (videoBar !== undefined) {
    max = Math.max(max, videoBar.end + TIMELINE_PADDING_MS);
  }
  return max;
}

/** wheel zoom step, clamped between 1x and TIMELINE_MAX_ZOOM */
export function getNextTimelineZoom(oldZoom: number, deltaY: number): number {
  const factor = deltaY > 0 ? 1 / 1.2 : 1.2;
  return Math.max(1, Math.min(TIMELINE_MAX_ZOOM, oldZoom * factor));
}
