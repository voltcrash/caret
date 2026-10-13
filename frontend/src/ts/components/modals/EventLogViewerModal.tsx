import {
  createDeferred,
  createEffect,
  createMemo,
  For,
  JSXElement,
  Show,
  untrack,
} from "solid-js";

import type { EventLog, TestEventType } from "../../test/events/types";

import {
  EVENT_TYPES,
  getCurrentMs,
  getError,
  getEventLog,
  getRaw,
  getStage,
  getVisibleTypes,
  resetEventLogViewer,
  setCurrentMs,
  setError,
  setEventLog,
  setRaw,
  setStage,
  setVisibleTypes,
} from "../../states/event-log-viewer";
import { hideModal } from "../../states/modals";
import { getLastEventLog } from "../../states/test";
import { cn } from "../../utils/cn";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { createPlayback } from "./event-log-viewer/createPlayback";
import { createVideoSync } from "./event-log-viewer/createVideoSync";
import { DistributionPanel } from "./event-log-viewer/DistributionPanel";
import { DriftChart } from "./event-log-viewer/DriftChart";
import {
  getCurrentEventIndex,
  getCurrentWordIndex,
  getMaxTestMs,
  inputsPerWord,
  parseContext,
  visualizeWhitespace,
} from "./event-log-viewer/event-log";
import { EventMarkSelect } from "./event-log-viewer/EventMarkSelect";
import { ScatterPanel } from "./event-log-viewer/ScatterPanel";
import { scrollRowIntoView } from "./event-log-viewer/scroll-row";
import { Timeline } from "./event-log-viewer/Timeline";
import {
  buildLanes,
  getTimelineMaxMs,
  getTimelineMinMs,
} from "./event-log-viewer/timeline-lanes";
import { VideoPanel } from "./event-log-viewer/VideoPanel";
import { WordsPanel } from "./event-log-viewer/WordsPanel";

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
  const sync = createVideoSync(() => props.ctx.events);
  const { isSynced, videoMapping, videoBarRange, timelineMarks, driftData } =
    sync;

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

  let eventsScrollEl: HTMLDivElement | undefined;

  createEffect(() => {
    scrollRowIntoView(eventsScrollEl, currentEventIndex());
  });

  const {
    playing,
    togglePlay,
    step,
    goToStart,
    goToEnd,
    goNextEvent,
    goPrevEvent,
  } = createPlayback({
    sync,
    events: filteredEvents,
    minMs: timelineMinMs,
    maxMs: timelineMaxMs,
  });

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
        <VideoPanel sync={sync} />

        {/* INSPECTOR: words */}
        <WordsPanel
          targetWords={props.ctx.context.targetWords}
          finalInputs={finalInputs}
          currentWordIndex={currentWordIndex()}
        />

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
                        <EventMarkSelect
                          sync={sync}
                          eventIndex={originalIndex}
                        />
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
