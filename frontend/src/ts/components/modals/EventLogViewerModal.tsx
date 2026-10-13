import {
  createDeferred,
  createEffect,
  createMemo,
  createSignal,
  For,
  JSXElement,
  onCleanup,
  Show,
  untrack,
} from "solid-js";

import type {
  EventLog,
  TestEventNoMs,
  TestEventType,
} from "../../test/events/types";

import {
  EVENT_TYPES,
  getCurrentMs,
  getError,
  getEventLog,
  getEventToMark,
  getMarks,
  getRaw,
  getStage,
  getSyncEnabled,
  getTimelineZoom,
  getVideoUrl,
  getVisibleTypes,
  type Mark,
  nextMarkId,
  resetEventLogViewer,
  setCurrentMs,
  setError,
  setEventLog,
  setEventToMark,
  setMarks,
  setRaw,
  setStage,
  setSyncEnabled,
  setTimelineZoom,
  setVideoFile,
  setVisibleTypes,
  type SyncKind,
} from "../../states/event-log-viewer";
import { hideModal } from "../../states/modals";
import { getLastEventLog } from "../../states/test";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { DistributionPanel } from "./event-log-viewer/DistributionPanel";
import {
  getCurrentEventIndex,
  getCurrentWordIndex,
  getMaxTestMs,
  getNextEventMs,
  getPreviousEventMs,
  inputsPerWord,
  parseContext,
  visualizeWhitespace,
} from "./event-log-viewer/event-log";
import { ScatterPanel } from "./event-log-viewer/ScatterPanel";
import {
  buildLanes,
  getNextTimelineZoom,
  getTimelineMaxMs,
  getTimelineMinMs,
  TIMELINE_LANE_GAP,
  TIMELINE_TRACK_HEIGHT,
  type TimelineMark,
  type TimelineSegment,
  type VideoBar,
} from "./event-log-viewer/timeline-lanes";
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
  marksForEvent,
  medianFps,
  testMsToVideoMs as toVideoMs,
  unassignedMarks,
  unassignMark,
  type VideoMapping,
  videoMsToTestMs as toTestMs,
} from "./event-log-viewer/video-sync";

const TYPE_BG: Record<TestEventType, string> = {
  keydown: "bg-text",
  keyup: "bg-error",
  input: "bg-main",
  timer: "bg-sub",
  composition: "bg-sub-alt",
};

export function EventLogViewerModal(): JSXElement {
  const stage = getStage;
  const raw = getRaw;
  const ctx = getEventLog;
  const err = getError;

  const loadFrom = (json: string): void => {
    try {
      const parsed = parseContext(json);
      setEventLog(parsed);
      setError(null);
      setStage("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onShow = (): void => loadFrom(raw());

  const onLoadLatest = (): void => {
    const log = getLastEventLog();
    if (log === null) {
      setError("No event log available - complete a test first");
      return;
    }
    const json = JSON.stringify(log);
    setRaw(json);
    loadFrom(json);
  };

  return (
    <AnimatedModal
      id="EventLogViewer"
      title="Event Log Viewer"
      modalClass="max-w-full h-full flex flex-col overflow-hidden"
      // deliberately no beforeShow reset. AnimatedModal re-runs its visibility
      // effect whenever it mounts, and a hot reload remounts it while the modal
      // store still says open - so a reset hook here wipes the loaded log on
      // every save, which is the exact thing the separate state module exists
      // to prevent. clearing is an explicit button instead
    >
      <Show when={stage() === "input"}>
        <div class="flex flex-col gap-4">
          <textarea
            class="bg-bg-secondary h-64 w-full rounded p-2 font-mono text-xs text-text"
            placeholder='{"version": 1, "events": [...], "context": {...}}'
            value={raw()}
            onInput={(e) => setRaw(e.currentTarget.value)}
            autocomplete="off"
          ></textarea>
          <Show when={err()}>
            <div class="text-sm text-error">{err()}</div>
          </Show>
          <div class="flex justify-end gap-2">
            <Button
              variant="button"
              onClick={onLoadLatest}
              fa={{ icon: "fa-download" }}
              text="Load latest data"
              balloon={{ text: "Load the event log from the last test" }}
            />
            <Button
              variant="button"
              onClick={resetEventLogViewer}
              fa={{ icon: "fa-trash" }}
              text="Clear"
              balloon={{
                text: "Throw away the loaded log, marks and video. State is kept across closing the modal and across hot reloads, so this is the only thing that clears it.",
              }}
            />
            <Button
              variant="button"
              onClick={() => hideModal("EventLogViewer")}
              text="Cancel"
            />
            <Button variant="button" onClick={onShow} text="Show" />
          </div>
        </div>
      </Show>
      <Show when={stage() === "preview" && ctx() !== null}>
        <PreviewContent
          ctx={ctx() as EventLog}
          onBack={() => setStage("input")}
        />
      </Show>
    </AnimatedModal>
  );
}

function PreviewContent(props: {
  ctx: EventLog;
  onBack: () => void;
}): JSXElement {
  const maxMs = untrack(() => getMaxTestMs(props.ctx.events));
  const videoUrl = getVideoUrl;
  const [videoEl, setVideoEl] = createSignal<HTMLVideoElement | undefined>(
    undefined,
  );
  const [videoDurationMs, setVideoDurationMs] = createSignal<number | null>(
    null,
  );

  const marks = getMarks;
  // eventIndex (index into props.ctx.events) → mark id
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
    return props.ctx.events[idx];
  });
  const syncEndEvent = createMemo(() => {
    const m = syncEndMark();
    if (m === undefined) return undefined;
    const idx = eventIndexForMark(m.id);
    if (idx === undefined) return undefined;
    return props.ctx.events[idx];
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
    return getDriftPoints(
      marks(),
      eventToMark(),
      props.ctx.events,
      videoMapping(),
    );
  });

  const timelineMinMs = createMemo(() => getTimelineMinMs(videoBarRange()));
  const timelineMaxMs = createMemo(() =>
    getTimelineMaxMs(maxMs, videoBarRange()),
  );

  const currentMs = getCurrentMs;

  const visibleEvents = createMemo(() =>
    props.ctx.events.filter((e) => e.testMs <= currentMs()),
  );

  // the stats panels read this rather than the full log, so scrubbing the
  // timeline rebuilds them from only what has happened so far. deferred because
  // recomputing them - the quantum sweep above all - on every animation frame
  // would make playback crawl; solid drops the intermediate values and settles
  // on the latest once the playhead stops moving
  const visibleLog = createMemo((): EventLog => ({
    ...props.ctx,
    events: visibleEvents(),
  }));
  const statsLog = createDeferred(visibleLog, { timeoutMs: 250 });

  const finalInputs = untrack(() =>
    inputsPerWord(props.ctx.events, props.ctx.context.targetWords.length),
  );

  const liveInputs = createMemo(() =>
    inputsPerWord(visibleEvents(), props.ctx.context.targetWords.length),
  );

  const simulatedInput = createMemo(() =>
    visualizeWhitespace(
      liveInputs()
        .filter((w) => w.length > 0)
        .join(""),
    ),
  );

  const currentWordIndex = createMemo(() =>
    getCurrentWordIndex(visibleEvents()),
  );

  const visibleTypes = getVisibleTypes;

  const toggleType = (t: TestEventType): void => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const filteredEvents = createMemo(() =>
    props.ctx.events.filter((e) => visibleTypes().has(e.type)),
  );

  const filteredEventsWithIndex = createMemo(() =>
    props.ctx.events
      .map((event, originalIndex) => ({ event, originalIndex }))
      .filter(({ event }) => visibleTypes().has(event.type)),
  );

  const timelineLanes = createMemo(() =>
    buildLanes(props.ctx.events, visibleTypes()),
  );

  const currentEventIndex = createMemo(() =>
    getCurrentEventIndex(filteredEvents(), currentMs()),
  );

  let wordsScrollEl: HTMLDivElement | undefined;
  let eventsScrollEl: HTMLDivElement | undefined;

  const scrollRowIntoView = (
    container: HTMLDivElement | undefined,
    idx: number,
  ): void => {
    if (container === undefined || idx < 0) return;
    const row = container.querySelector<HTMLElement>(`[data-row="${idx}"]`);
    if (row === null) return;
    const containerRect = container.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const stickyHead =
      container.querySelector<HTMLElement>("thead")?.getBoundingClientRect()
        .height ?? 0;
    if (rowRect.top < containerRect.top + stickyHead) {
      container.scrollTop -= containerRect.top + stickyHead - rowRect.top;
    } else if (rowRect.bottom > containerRect.bottom) {
      container.scrollTop += rowRect.bottom - containerRect.bottom;
    }
  };

  createEffect(() => {
    scrollRowIntoView(wordsScrollEl, currentWordIndex());
  });

  createEffect(() => {
    scrollRowIntoView(eventsScrollEl, currentEventIndex());
  });

  const [timelinePlaying, setTimelinePlaying] = createSignal(false);
  let rafId: number | undefined;
  let lastFrame: number | undefined;

  const playing = createMemo(() =>
    isSynced() ? videoPlayState() : timelinePlaying(),
  );

  const stopTimelinePlay = (): void => {
    if (rafId !== undefined) cancelAnimationFrame(rafId);
    rafId = undefined;
    lastFrame = undefined;
    setTimelinePlaying(false);
  };

  const tick = (now: number): void => {
    if (lastFrame === undefined) {
      lastFrame = now;
      rafId = requestAnimationFrame(tick);
      return;
    }
    const dt = now - lastFrame;
    lastFrame = now;
    const next = currentMs() + dt;
    if (next >= timelineMaxMs()) {
      setCurrentMs(timelineMaxMs());
      stopTimelinePlay();
      return;
    }
    setCurrentMs(Math.round(next));
    rafId = requestAnimationFrame(tick);
  };

  const togglePlay = (): void => {
    if (isSynced()) {
      const el = videoEl();
      if (el === undefined) return;
      if (el.paused) {
        if (currentMs() >= timelineMaxMs()) setCurrentMs(timelineMinMs());
        void el.play().catch(() => undefined);
      } else {
        el.pause();
      }
      return;
    }
    if (timelinePlaying()) {
      stopTimelinePlay();
    } else {
      if (currentMs() >= timelineMaxMs()) setCurrentMs(timelineMinMs());
      setTimelinePlaying(true);
      lastFrame = undefined;
      rafId = requestAnimationFrame(tick);
    }
  };

  onCleanup(stopTimelinePlay);

  const stopAllPlay = (): void => {
    stopTimelinePlay();
    const el = videoEl();
    if (el !== undefined && isSynced() && !el.paused) el.pause();
  };

  const step = (delta: number): void => {
    stopAllPlay();
    const next = Math.max(
      timelineMinMs(),
      Math.min(timelineMaxMs(), currentMs() + delta),
    );
    setCurrentMs(next);
  };

  const goToStart = (): void => {
    stopAllPlay();
    setCurrentMs(timelineMinMs());
  };

  const goToEnd = (): void => {
    stopAllPlay();
    setCurrentMs(timelineMaxMs());
  };

  const goNextEvent = (): void => {
    stopAllPlay();
    setCurrentMs(
      getNextEventMs(filteredEvents(), currentMs()) ?? timelineMaxMs(),
    );
  };

  const goPrevEvent = (): void => {
    stopAllPlay();
    setCurrentMs(
      getPreviousEventMs(filteredEvents(), currentMs()) ?? timelineMinMs(),
    );
  };

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

  return (
    <div class="flex min-h-0 flex-1 flex-col gap-3">
      {/* HEADER */}
      <div class="flex shrink-0 items-center justify-between gap-2">
        <Button
          variant="text"
          onClick={props.onBack}
          fa={{ icon: "fa-arrow-left" }}
          text="Back"
        />
        <Show when={isSynced()}>
          <div class="flex items-center gap-2 rounded bg-main px-3 py-1 text-xs font-bold tracking-wider text-bg uppercase">
            <span>● Synced</span>
            <span class="font-mono opacity-80">
              {videoMapping().slope.toFixed(4)}×
            </span>
          </div>
        </Show>
      </div>

      {/* SIDE-BY-SIDE: video | words | events */}
      <div class="flex min-h-0 flex-1 gap-3">
        {/* VIDEO VIEWER PANEL */}
        <div class="bg-bg-secondary flex min-h-0 w-0 flex-1 flex-col gap-2 overflow-auto rounded-lg p-3">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs tracking-wider text-sub uppercase">Viewer</div>
            <div class="flex items-center gap-2">
              <input
                type="file"
                accept="video/*"
                onChange={onPickVideo}
                class="text-xs text-text"
              />
              <Show when={videoUrl() !== null}>
                <Button
                  variant="text"
                  text="Clear"
                  class="text-xs"
                  onClick={clearVideo}
                />
              </Show>
            </div>
          </div>
          <Show
            when={videoUrl() !== null}
            fallback={
              <div class="flex h-64 items-center justify-center rounded bg-bg text-xs text-sub">
                No video loaded
              </div>
            }
          >
            <div class="flex justify-center">
              <video
                ref={(el) => setVideoEl(el)}
                src={videoUrl() ?? undefined}
                class="max-h-[60vh] w-full max-w-3xl rounded bg-bg object-contain"
                muted
                onLoadedMetadata={(e) =>
                  setVideoDurationMs(e.currentTarget.duration * 1000)
                }
                onPlay={() => setVideoPlayState(true)}
                onPause={() => setVideoPlayState(false)}
                onTimeUpdate={(e) => {
                  const ct = e.currentTarget.currentTime * 1000;
                  setVideoCurrentMs(ct);
                  if (isSynced()) setCurrentMs(videoMsToTestMs(ct));
                }}
              ></video>
            </div>
            <input
              type="range"
              min="0"
              max={videoDurationMs() ?? 0}
              step="1"
              value={videoCurrentMs()}
              onInput={(e) => seekVideoMs(Number(e.currentTarget.value))}
              class="w-full"
            />
            <div class="flex items-center justify-between gap-2">
              <div
                class="font-mono text-xs text-sub"
                title="current video frame index / time @ detected fps"
              >
                {currentFrameIndex() !== null
                  ? `${currentFrameIndex()} (${(videoFrameTimeMs() ?? 0).toFixed(2)}ms @ ${videoFps().toFixed(2)}fps)`
                  : "—"}
              </div>
              <div class="flex items-center gap-1">
                <Button
                  variant="text"
                  balloon={{ text: "Previous frame" }}
                  fa={{ icon: "fa-step-backward" }}
                  onClick={() => videoStepFrame(-1)}
                />
                <Button
                  variant="button"
                  balloon={{ text: videoPlayState() ? "Pause" : "Play" }}
                  fa={{ icon: videoPlayState() ? "fa-pause" : "fa-play" }}
                  onClick={toggleVideoPlay}
                />
                <Button
                  variant="text"
                  balloon={{ text: "Next frame" }}
                  fa={{ icon: "fa-step-forward" }}
                  onClick={() => videoStepFrame(1)}
                />
              </div>
              <Button
                variant="button"
                text={isSynced() ? "Synced" : "Sync"}
                active={isSynced()}
                disabled={!isSyncable()}
                balloon={{
                  text: isSyncable()
                    ? isSynced()
                      ? "Click to unsync"
                      : "Lock video to timeline"
                    : "Both sync marks must be placed and assigned to events",
                }}
                onClick={toggleSync}
              />
            </div>
          </Show>
          <Show when={videoUrl() !== null}>
            <div class="flex flex-wrap items-center gap-2 border-t border-bg pt-2">
              <div class="text-xs tracking-wider text-sub uppercase">Marks</div>
              <Button
                variant="text"
                text="+ mark"
                class="text-xs"
                disabled={!isSynced()}
                balloon={{
                  text: isSynced()
                    ? "Add a generic mark at the current video frame"
                    : "Add and assign both sync marks first",
                }}
                onClick={() => addMark()}
              />
              <Button
                variant="text"
                text="+ start sync"
                class="text-xs"
                disabled={syncStartMark() !== undefined}
                balloon={{
                  text: "Add the start sync mark at the current video frame",
                }}
                onClick={() => addMark("start")}
              />
              <Button
                variant="text"
                text="+ end sync"
                class="text-xs"
                disabled={syncEndMark() !== undefined}
                balloon={{
                  text: "Add the end sync mark at the current video frame",
                }}
                onClick={() => addMark("end")}
              />
              <Show when={unassignedMarks(marks(), eventToMark()).length > 0}>
                <For each={unassignedMarks(marks(), eventToMark())}>
                  {(mark) => (
                    <div class="flex items-center gap-1 rounded bg-bg p-1 font-mono text-xs">
                      <span class="text-text">{mark.sync ?? mark.id}</span>
                      <input
                        type="number"
                        value={mark.videoMs}
                        onInput={(e) =>
                          updateMarkVideoMs(
                            mark.id,
                            Number(e.currentTarget.value),
                          )
                        }
                        class="bg-bg-secondary w-20 rounded p-1 text-text"
                      />
                      <button
                        type="button"
                        class="cursor-pointer px-1 text-error"
                        onClick={() => removeMark(mark.id)}
                        title="Remove mark"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </Show>
        </div>

        {/* INSPECTOR: words */}
        <div class="bg-bg-secondary flex min-h-0 w-0 flex-1 flex-col gap-2 rounded-lg p-3">
          <div class="text-xs tracking-wider text-sub uppercase">Words</div>
          <div
            ref={(el) => (wordsScrollEl = el)}
            class="min-h-0 flex-1 overflow-auto rounded bg-bg"
          >
            <table class="w-full text-xs">
              <thead class="sticky top-0 bg-bg">
                <tr class="text-sub">
                  <th class="w-10 p-2 text-right">#</th>
                  <th class="p-2 text-left">target</th>
                  <th class="p-2 text-left">input</th>
                </tr>
              </thead>
              <tbody>
                <For each={props.ctx.context.targetWords}>
                  {(word, i) => (
                    <tr
                      data-row={i()}
                      class={cn(
                        "border-t border-bg",
                        i() === currentWordIndex() && "bg-main/20",
                      )}
                    >
                      <td class="p-2 text-right font-mono text-sub">{i()}</td>
                      <td class="p-2 font-mono">{visualizeWhitespace(word)}</td>
                      <td class="p-2 font-mono">
                        {visualizeWhitespace(finalInputs[i()] ?? "")}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>

        {/* INSPECTOR: events */}
        <div class="bg-bg-secondary flex min-h-0 w-0 flex-[1.5] flex-col gap-2 rounded-lg p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="text-xs tracking-wider text-sub uppercase">
              Events ({filteredEvents().length}/{props.ctx.events.length})
            </div>
            <div class="flex flex-wrap gap-2">
              <For each={EVENT_TYPES}>
                {(t) => (
                  <Button
                    variant="button"
                    active={visibleTypes().has(t)}
                    onClick={() => toggleType(t)}
                    text={t}
                    class="text-xs"
                  />
                )}
              </For>
            </div>
          </div>
          <div
            ref={(el) => (eventsScrollEl = el)}
            class="min-h-0 flex-1 overflow-auto rounded bg-bg"
          >
            <table class="w-full text-xs">
              <thead class="sticky top-0 bg-bg">
                <tr class="text-sub">
                  <th class="w-24 p-2 text-right">time</th>
                  <th class="w-24 p-2 text-left">type</th>
                  <th class="w-32 p-2 text-left">mark</th>
                  <th class="p-2 text-left">data</th>
                </tr>
              </thead>
              <tbody>
                <For each={filteredEventsWithIndex()}>
                  {({ event, originalIndex }, i) => (
                    <tr
                      data-row={i()}
                      class={cn(
                        "border-t border-bg",
                        i() === currentEventIndex() && "bg-main/20",
                        event.testMs > currentMs() && "opacity-40",
                      )}
                    >
                      <td class="p-2 text-right font-mono">
                        {event.testMs.toFixed(2)}
                      </td>
                      <td class="p-2 font-mono">{event.type}</td>
                      <td class="p-2">
                        <select
                          class="w-full rounded bg-bg p-1 font-mono text-xs text-text"
                          value={eventToMark()[originalIndex] ?? ""}
                          onChange={(e) => {
                            const v = e.currentTarget.value;
                            if (v === "") {
                              assignMarkToEvent(originalIndex, null);
                            } else if (v === "__new__") {
                              createMarkAndAssignToEvent(originalIndex);
                            } else if (v === "__new_start__") {
                              createSyncMarkAndAssignToEvent(
                                originalIndex,
                                "start",
                              );
                            } else if (v === "__new_end__") {
                              createSyncMarkAndAssignToEvent(
                                originalIndex,
                                "end",
                              );
                            } else {
                              assignMarkToEvent(originalIndex, v);
                            }
                            e.currentTarget.value =
                              eventToMark()[originalIndex] ?? "";
                          }}
                        >
                          <option value="">(none)</option>
                          <For
                            each={marksForEvent(
                              marks(),
                              eventToMark(),
                              originalIndex,
                            )}
                          >
                            {(mark) => (
                              <option value={mark.id}>
                                {mark.sync ?? mark.id} (
                                {mark.videoMs.toFixed(0)}
                                ms)
                              </option>
                            )}
                          </For>
                          <Show
                            when={
                              videoUrl() !== null &&
                              syncStartMark() === undefined
                            }
                          >
                            <option value="__new_start__">
                              + start sync mark @ frame
                            </option>
                          </Show>
                          <Show
                            when={
                              videoUrl() !== null && syncEndMark() === undefined
                            }
                          >
                            <option value="__new_end__">
                              + end sync mark @ frame
                            </option>
                          </Show>
                          <Show when={isSynced()}>
                            <option value="__new__">
                              + new mark at playhead
                            </option>
                          </Show>
                        </select>
                      </td>
                      <td class="p-2 font-mono break-all">
                        {JSON.stringify(event.data)}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* INSPECTOR: simulated input */}
      <div class="bg-bg-secondary flex shrink-0 flex-col gap-2 rounded-lg p-3">
        <div class="text-xs tracking-wider text-sub uppercase">
          Simulated input
        </div>
        <div class="max-h-24 min-h-10 overflow-auto rounded bg-bg p-2 font-mono text-sm break-all whitespace-pre-wrap">
          {simulatedInput()}
        </div>
      </div>

      {/* KEY TIMING DISTRIBUTION PANEL */}
      <DistributionPanel ctx={statsLog()} fullCtx={props.ctx} />

      {/* KEY TIMING SCATTER PANEL */}
      <ScatterPanel ctx={statsLog()} fullCtx={props.ctx} />

      {/* TIMELINE PANEL */}
      <div class="bg-bg-secondary flex shrink-0 flex-col gap-2 rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div class="text-xs tracking-wider text-sub uppercase">Timeline</div>
          <div class="font-mono text-xs text-sub">
            {currentMs().toFixed(2)} / {maxMs} ms
          </div>
        </div>
        <div class="flex items-center justify-center gap-1">
          <Button
            variant="text"
            balloon={{ text: "Go to start" }}
            fa={{ icon: "fa-fast-backward" }}
            onClick={goToStart}
          />
          <Button
            variant="text"
            balloon={{ text: "-10ms" }}
            fa={{ icon: "fa-backward" }}
            onClick={() => step(-10)}
          />
          <Button
            variant="text"
            balloon={{ text: "-1ms" }}
            fa={{ icon: "fa-chevron-left" }}
            onClick={() => step(-1)}
          />
          <Button
            variant="text"
            balloon={{ text: "Previous event" }}
            fa={{ icon: "fa-step-backward" }}
            onClick={goPrevEvent}
          />
          <Button
            variant="button"
            balloon={{ text: playing() ? "Pause" : "Play" }}
            fa={{ icon: playing() ? "fa-pause" : "fa-play" }}
            onClick={togglePlay}
          />
          <Button
            variant="text"
            balloon={{ text: "Next event" }}
            fa={{ icon: "fa-step-forward" }}
            onClick={goNextEvent}
          />
          <Button
            variant="text"
            balloon={{ text: "+1ms" }}
            fa={{ icon: "fa-chevron-right" }}
            onClick={() => step(1)}
          />
          <Button
            variant="text"
            balloon={{ text: "+10ms" }}
            fa={{ icon: "fa-forward" }}
            onClick={() => step(10)}
          />
          <Button
            variant="text"
            balloon={{ text: "Go to end" }}
            fa={{ icon: "fa-fast-forward" }}
            onClick={goToEnd}
          />
        </div>
        <Show when={driftData().length > 0}>
          <DriftChart
            data={driftData()}
            minMs={timelineMinMs()}
            maxMs={timelineMaxMs()}
          />
        </Show>
        <Timeline
          segments={timelineLanes().segments}
          totalHeight={timelineLanes().totalHeight}
          minMs={timelineMinMs()}
          maxMs={timelineMaxMs()}
          currentMs={currentMs()}
          onSeek={setCurrentMs}
          videoBar={videoBarRange()}
          marks={timelineMarks()}
        />
      </div>
    </div>
  );
}

function Timeline(props: {
  segments: TimelineSegment[];
  totalHeight: number;
  minMs: number;
  maxMs: number;
  currentMs: number;
  onSeek: (ms: number) => void;
  videoBar?: VideoBar;
  marks?: TimelineMark[];
}): JSXElement {
  const range = (): number => Math.max(props.maxMs - props.minMs, 1);
  const scale = (ms: number): number => ((ms - props.minMs) / range()) * 100;
  const dotSize = 4;
  const dotOffset = (TIMELINE_TRACK_HEIGHT - dotSize) / 2;
  const segmentYOffset = (): number =>
    props.videoBar !== undefined
      ? TIMELINE_TRACK_HEIGHT + TIMELINE_LANE_GAP
      : 0;
  const adjustedHeight = (): number => props.totalHeight + segmentYOffset();

  const zoom = getTimelineZoom;
  const setZoom = setTimelineZoom;
  let scrollEl: HTMLDivElement | undefined;
  let containerEl: HTMLDivElement | undefined;

  const seekFromPointer = (clientX: number): void => {
    if (containerEl === undefined) return;
    const rect = containerEl.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    props.onSeek(Math.round(props.minMs + pct * range()));
  };

  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    seekFromPointer(e.clientX);
  };

  const onPointerMove = (e: PointerEvent): void => {
    const el = e.currentTarget as HTMLDivElement;
    if (!el.hasPointerCapture(e.pointerId)) return;
    seekFromPointer(e.clientX);
  };

  const onPointerUp = (e: PointerEvent): void => {
    const el = e.currentTarget as HTMLDivElement;
    if (el.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
  };

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (scrollEl === undefined) return;
    const rect = scrollEl.getBoundingClientRect();
    const viewX = e.clientX - rect.left;
    const contentX = viewX + scrollEl.scrollLeft;
    const oldZoom = zoom();
    const newZoom = getNextTimelineZoom(oldZoom, e.deltaY);
    if (newZoom === oldZoom) return;
    setZoom(newZoom);
    requestAnimationFrame(() => {
      if (scrollEl === undefined) return;
      const newContentX = contentX * (newZoom / oldZoom);
      scrollEl.scrollLeft = newContentX - viewX;
    });
  };

  return (
    <div
      ref={(el) => (scrollEl = el)}
      class="relative w-full overflow-x-auto"
      onWheel={onWheel}
    >
      <div
        ref={(el) => (containerEl = el)}
        class="relative cursor-ew-resize touch-none overflow-hidden bg-bg select-none"
        style={{
          height: `${adjustedHeight()}px`,
          width: `${zoom() * 100}%`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <Show when={props.videoBar}>
          {(bar) => (
            <div
              title="Video"
              class="absolute rounded-[2px] bg-sub-alt"
              style={{
                left: `${scale(bar().start)}%`,
                width: `max(${((bar().end - bar().start) / range()) * 100}%, 2px)`,
                top: "0px",
                height: `${TIMELINE_TRACK_HEIGHT}px`,
              }}
            ></div>
          )}
        </Show>
        <For each={props.segments}>
          {(seg) => {
            if (seg.kind === "bar") {
              return (
                <div
                  title={seg.label}
                  class={cn(
                    "absolute rounded-[2px]",
                    seg.bg ?? TYPE_BG[seg.type],
                  )}
                  style={{
                    left: `${scale(seg.start)}%`,
                    width: `max(${((seg.end - seg.start) / range()) * 100}%, 2px)`,
                    top: `${seg.topPx + segmentYOffset()}px`,
                    height: `${TIMELINE_TRACK_HEIGHT}px`,
                  }}
                ></div>
              );
            }
            return (
              <div
                title={seg.label}
                class={cn("absolute rounded-full", seg.bg ?? TYPE_BG[seg.type])}
                style={{
                  left: `calc(${scale(seg.start)}% - ${dotSize / 2}px)`,
                  width: `${dotSize}px`,
                  height: `${dotSize}px`,
                  top: `${seg.topPx + dotOffset + segmentYOffset()}px`,
                }}
              ></div>
            );
          }}
        </For>
        <For each={props.marks ?? []}>
          {(mark) => (
            <div
              title={mark.label}
              class={cn(
                "absolute top-0 bottom-0 w-0.5",
                mark.sync !== undefined ? "bg-main" : "bg-text",
              )}
              style={{
                left: `${scale(mark.testMs)}%`,
                transform: "translateX(-50%)",
              }}
            ></div>
          )}
        </For>
        <div
          class="absolute top-0 bottom-0 w-px bg-main"
          style={{
            left: `${scale(props.currentMs)}%`,
            transform: "translateX(-50%)",
          }}
        ></div>
      </div>
    </div>
  );
}

function DriftChart(props: {
  data: DriftPoint[];
  minMs: number;
  maxMs: number;
}): JSXElement {
  const HEIGHT = 60;
  const range = (): number => Math.max(props.maxMs - props.minMs, 1);
  const xPct = (ms: number): number => ((ms - props.minMs) / range()) * 100;
  const yMaxAbs = (): number => {
    let max = 50;
    for (const p of props.data) {
      if (Math.abs(p.driftMs) > max) max = Math.abs(p.driftMs);
    }
    return Math.ceil(max);
  };
  const yPx = (drift: number): number =>
    HEIGHT / 2 - (drift / yMaxAbs()) * (HEIGHT / 2 - 4);

  return (
    <div class="bg-bg-secondary relative w-full overflow-hidden rounded">
      <div
        class="absolute top-0 right-0 px-1 font-mono text-xs text-sub"
        style={{ "line-height": "1" }}
      >
        +{yMaxAbs()}ms
      </div>
      <div
        class="absolute right-0 bottom-0 px-1 font-mono text-xs text-sub"
        style={{ "line-height": "1" }}
      >
        −{yMaxAbs()}ms
      </div>
      <div
        class="absolute left-1 px-1 font-mono text-xs text-sub"
        style={{ top: `${HEIGHT / 2 - 6}px`, "line-height": "1" }}
      >
        drift
      </div>
      <div class="relative w-full" style={{ height: `${HEIGHT}px` }}>
        <div
          class="absolute right-0 left-0 h-px bg-sub"
          style={{ top: `${HEIGHT / 2}px` }}
        ></div>
        <For each={props.data}>
          {(p) => (
            <div
              class="absolute rounded-full bg-main"
              title={`${p.label}: ${p.driftMs.toFixed(2)}ms @ test ${p.eventTestMs.toFixed(2)}ms`}
              style={{
                left: `calc(${xPct(p.eventTestMs)}% - 3px)`,
                top: `${yPx(p.driftMs) - 3}px`,
                width: "6px",
                height: "6px",
              }}
            ></div>
          )}
        </For>
      </div>
    </div>
  );
}
