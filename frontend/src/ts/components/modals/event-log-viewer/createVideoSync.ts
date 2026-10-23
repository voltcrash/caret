import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  Setter,
} from "solid-js";

import type { TestEventNoMs } from "@oxytype/web-shared/events/types";
import type { TimelineMark, VideoBar } from "./timeline-lanes";

import {
  getCurrentMs,
  getEventToMark,
  getMarks,
  getSyncEnabled,
  getVideoUrl,
  type Mark,
  nextMarkId,
  setEventToMark,
  setMarks,
  setSyncEnabled,
  setVideoFile,
  type SyncKind,
} from "../../../states/event-log-viewer";
import {
  assignMark,
  clampVideoSeconds,
  computeVideoMapping,
  type DriftPoint,
  eventIndexForMark as eventIndexForMarkIn,
  getDriftPoints,
  getFrameIndex,
  getTimelineMarks,
  getVideoBarRange,
  identityMapping,
  medianFps,
  testMsToVideoMs as toVideoMs,
  unassignMark,
  type VideoMapping,
  videoMsToTestMs as toTestMs,
} from "./video-sync";

export type VideoSync = {
  videoUrl: Accessor<string | null>;
  videoEl: Accessor<HTMLVideoElement | undefined>;
  setVideoEl: Setter<HTMLVideoElement | undefined>;
  videoDurationMs: Accessor<number | null>;
  setVideoDurationMs: Setter<number | null>;
  videoPlayState: Accessor<boolean>;
  setVideoPlayState: Setter<boolean>;
  videoCurrentMs: Accessor<number>;
  setVideoCurrentMs: Setter<number>;
  videoFrameTimeMs: Accessor<number | null>;
  videoFps: Accessor<number>;
  currentFrameIndex: () => number | null;
  marks: Accessor<Mark[]>;
  eventToMark: Accessor<Record<number, string>>;
  syncStartMark: Accessor<Mark | undefined>;
  syncEndMark: Accessor<Mark | undefined>;
  isSyncable: Accessor<boolean>;
  isSynced: Accessor<boolean>;
  toggleSync: () => void;
  videoMapping: Accessor<VideoMapping>;
  testMsToVideoMs: (testMs: number) => number;
  videoMsToTestMs: (videoMs: number) => number;
  videoBarRange: Accessor<VideoBar | undefined>;
  timelineMarks: Accessor<TimelineMark[]>;
  driftData: Accessor<DriftPoint[]>;
  onPickVideo: (e: Event) => void;
  clearVideo: () => void;
  addMark: (sync?: SyncKind) => void;
  removeMark: (id: string) => void;
  updateMarkVideoMs: (id: string, videoMs: number) => void;
  assignMarkToEvent: (eventIndex: number, markId: string | null) => void;
  createMarkAndAssignToEvent: (eventIndex: number) => void;
  createSyncMarkAndAssignToEvent: (eventIndex: number, sync: SyncKind) => void;
  seekVideoMs: (videoMs: number) => void;
  toggleVideoPlay: () => void;
  videoStepFrame: (delta: number) => void;
};

/**
 * The loaded video, its marks and the mapping between video and test time.
 * Persistent bits (url, marks, assignments, sync toggle) live in the state
 * module; the element and what it reports about itself live here.
 */
export function createVideoSync(events: () => TestEventNoMs[]): VideoSync {
  const videoUrl = getVideoUrl;
  const [videoEl, setVideoEl] = createSignal<HTMLVideoElement | undefined>(
    undefined,
  );
  const [videoDurationMs, setVideoDurationMs] = createSignal<number | null>(
    null,
  );
  const [videoPlayState, setVideoPlayState] = createSignal(false);
  const [videoCurrentMs, setVideoCurrentMs] = createSignal(0);
  const [videoFrameTimeMs, setVideoFrameTimeMs] = createSignal<number | null>(
    null,
  );
  const [videoFps, setVideoFps] = createSignal<number>(30);
  const frameMs = (): number => 1000 / videoFps();
  const currentFrameIndex = (): number | null => {
    const t = videoFrameTimeMs();
    if (t === null) return null;
    return getFrameIndex(t, videoFps());
  };

  const currentMs = getCurrentMs;
  const marks = getMarks;
  // eventIndex (index into the log's events) → mark id
  const eventToMark = getEventToMark;

  const syncStartMark = createMemo(() =>
    marks().find((m) => m.sync === "start"),
  );
  const syncEndMark = createMemo(() => marks().find((m) => m.sync === "end"));

  const eventIndexForMark = (id: string): number | undefined =>
    eventIndexForMarkIn(eventToMark(), id);

  const syncStartEvent = createMemo(() => {
    const m = syncStartMark();
    if (m === undefined) return undefined;
    const idx = eventIndexForMark(m.id);
    if (idx === undefined) return undefined;
    return events()[idx];
  });
  const syncEndEvent = createMemo(() => {
    const m = syncEndMark();
    if (m === undefined) return undefined;
    const idx = eventIndexForMark(m.id);
    if (idx === undefined) return undefined;
    return events()[idx];
  });

  const isSyncable = createMemo(
    () => syncStartEvent() !== undefined && syncEndEvent() !== undefined,
  );
  const syncEnabled = getSyncEnabled;
  const isSynced = createMemo(() => isSyncable() && syncEnabled());

  createEffect(() => {
    if (!isSyncable() && syncEnabled()) setSyncEnabled(false);
  });

  const toggleSync = (): void => {
    if (!isSyncable()) return;
    setSyncEnabled(!syncEnabled());
  };

  const videoMapping = createMemo((): VideoMapping => {
    if (!isSynced()) return identityMapping();
    return computeVideoMapping(
      syncStartMark() as Mark,
      syncEndMark() as Mark,
      syncStartEvent() as TestEventNoMs,
      syncEndEvent() as TestEventNoMs,
    );
  });

  const testMsToVideoMs = (testMs: number): number =>
    toVideoMs(videoMapping(), testMs);

  const videoMsToTestMs = (videoMs: number): number =>
    toTestMs(videoMapping(), videoMs);

  const videoBarRange = createMemo(() => {
    if (!isSynced()) return undefined;
    const dur = videoDurationMs();
    if (dur === null) return undefined;
    return getVideoBarRange(videoMapping(), dur);
  });

  const timelineMarks = createMemo((): TimelineMark[] => {
    if (!isSynced()) return [];
    return getTimelineMarks(marks(), videoMapping());
  });

  const driftData = createMemo((): DriftPoint[] => {
    if (!isSynced()) return [];
    return getDriftPoints(marks(), eventToMark(), events(), videoMapping());
  });

  const onPickVideo = (e: Event): void => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file === undefined) return;
    setVideoFile(file);
  };

  const clearVideo = (): void => {
    setVideoFile(null);
    setVideoDurationMs(null);
  };

  // while synced and paused the video follows the playhead
  createEffect(() => {
    const el = videoEl();
    if (el === undefined) return;
    if (!isSynced()) return;
    if (videoPlayState()) return;
    const t = testMsToVideoMs(currentMs()) / 1000;
    if (!Number.isFinite(t) || t < 0) return;
    if (Number.isFinite(el.duration) && t > el.duration) return;
    if (Math.abs(el.currentTime - t) > 0.001) {
      el.currentTime = t;
    }
  });

  const addMark = (sync?: SyncKind): void => {
    const el = videoEl();
    if (el === undefined) return;
    if (sync !== undefined && marks().some((m) => m.sync === sync)) return;
    const frameMs = videoFrameTimeMs();
    const currentMsFromEl = el.currentTime * 1000;
    const videoMs = frameMs ?? currentMsFromEl;
    setMarks([...marks(), { id: nextMarkId(), videoMs, sync }]);
  };

  const removeMark = (id: string): void => {
    setMarks(marks().filter((m) => m.id !== id));
    setEventToMark(unassignMark(eventToMark(), id));
  };

  const updateMarkVideoMs = (id: string, videoMs: number): void => {
    setMarks(marks().map((m) => (m.id === id ? { ...m, videoMs } : m)));
  };

  const assignMarkToEvent = (
    eventIndex: number,
    markId: string | null,
  ): void => {
    setEventToMark(assignMark(eventToMark(), eventIndex, markId));
  };

  const createMarkAndAssignToEvent = (eventIndex: number): void => {
    if (!isSynced()) return;
    const videoMs = testMsToVideoMs(currentMs());
    const id = nextMarkId();
    setMarks([...marks(), { id, videoMs }]);
    assignMarkToEvent(eventIndex, id);
  };

  const createSyncMarkAndAssignToEvent = (
    eventIndex: number,
    sync: SyncKind,
  ): void => {
    if (marks().some((m) => m.sync === sync)) return;
    const el = videoEl();
    if (el === undefined) return;
    const frameMs = videoFrameTimeMs();
    const currentMsFromEl = el.currentTime * 1000;
    const videoMs = frameMs ?? currentMsFromEl;
    const id = nextMarkId();
    setMarks([...marks(), { id, videoMs, sync }]);
    assignMarkToEvent(eventIndex, id);
  };

  createEffect(() => {
    const el = videoEl();
    if (el === undefined) return;
    type Metadata = { mediaTime: number };
    type RVFCElement = HTMLVideoElement & {
      requestVideoFrameCallback?: (
        cb: (now: number, metadata: Metadata) => void,
      ) => number;
    };
    const rvfcEl = el as RVFCElement;
    if (typeof rvfcEl.requestVideoFrameCallback !== "function") return;
    let lastMt = -1;
    const samples: number[] = [];
    const cb = (_now: number, metadata: Metadata): void => {
      const mt = metadata.mediaTime;
      setVideoFrameTimeMs(mt * 1000);
      if (lastMt >= 0) {
        const dt = mt - lastMt;
        if (dt > 0 && dt < 0.1) {
          samples.push(1 / dt);
          if (samples.length > 30) samples.shift();
          const median = medianFps(samples);
          if (median !== undefined) setVideoFps(median);
        }
      }
      lastMt = mt;
      rvfcEl.requestVideoFrameCallback?.(cb);
    };
    rvfcEl.requestVideoFrameCallback(cb);
  });

  const seekVideoMs = (videoMs: number): void => {
    const el = videoEl();
    if (el === undefined) return;
    el.currentTime = clampVideoSeconds(videoMs / 1000, el.duration);
  };

  const toggleVideoPlay = (): void => {
    const el = videoEl();
    if (el === undefined) return;
    if (el.paused) {
      void el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  };

  const videoStepFrame = (delta: number): void => {
    const el = videoEl();
    if (el === undefined) return;
    el.pause();
    const t = el.currentTime + (delta * frameMs()) / 1000;
    el.currentTime = clampVideoSeconds(t, el.duration);
  };

  return {
    videoUrl,
    videoEl,
    setVideoEl,
    videoDurationMs,
    setVideoDurationMs,
    videoPlayState,
    setVideoPlayState,
    videoCurrentMs,
    setVideoCurrentMs,
    videoFrameTimeMs,
    videoFps,
    currentFrameIndex,
    marks,
    eventToMark,
    syncStartMark,
    syncEndMark,
    isSyncable,
    isSynced,
    toggleSync,
    videoMapping,
    testMsToVideoMs,
    videoMsToTestMs,
    videoBarRange,
    timelineMarks,
    driftData,
    onPickVideo,
    clearVideo,
    addMark,
    removeMark,
    updateMarkVideoMs,
    assignMarkToEvent,
    createMarkAndAssignToEvent,
    createSyncMarkAndAssignToEvent,
    seekVideoMs,
    toggleVideoPlay,
    videoStepFrame,
  };
}
