import {
  createDeferred,
  createMemo,
  JSXElement,
  Show,
  untrack,
} from "solid-js";

import type { EventLog } from "../../test/events/types";

import {
  getCurrentMs,
  getError,
  getEventLog,
  getRaw,
  getStage,
  getVisibleTypes,
  resetEventLogViewer,
  setError,
  setEventLog,
  setRaw,
  setStage,
} from "../../states/event-log-viewer";
import { hideModal } from "../../states/modals";
import { getLastEventLog } from "../../states/test";
import { AnimatedModal } from "../common/AnimatedModal";
import { Button } from "../common/Button";
import { createPlayback } from "./event-log-viewer/createPlayback";
import { createVideoSync } from "./event-log-viewer/createVideoSync";
import { DistributionPanel } from "./event-log-viewer/DistributionPanel";
import {
  getCurrentEventIndex,
  getCurrentWordIndex,
  getMaxTestMs,
  inputsPerWord,
  parseContext,
  visualizeWhitespace,
} from "./event-log-viewer/event-log";
import { EventsPanel } from "./event-log-viewer/EventsPanel";
import { ScatterPanel } from "./event-log-viewer/ScatterPanel";
import { SimulatedInputPanel } from "./event-log-viewer/SimulatedInputPanel";
import {
  buildLanes,
  getTimelineMaxMs,
  getTimelineMinMs,
} from "./event-log-viewer/timeline-lanes";
import { TimelinePanel } from "./event-log-viewer/TimelinePanel";
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
  const { isSynced, videoMapping, videoBarRange } = sync;

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

  const playback = createPlayback({
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
        <EventsPanel
          sync={sync}
          rows={filteredEventsWithIndex()}
          totalCount={props.ctx.events.length}
          currentEventIndex={currentEventIndex()}
        />
      </div>

      {/* INSPECTOR: simulated input */}
      <SimulatedInputPanel text={simulatedInput()} />

      {/* KEY TIMING DISTRIBUTION PANEL */}
      <DistributionPanel ctx={statsLog()} fullCtx={props.ctx} />

      {/* KEY TIMING SCATTER PANEL */}
      <ScatterPanel ctx={statsLog()} fullCtx={props.ctx} />

      {/* TIMELINE PANEL */}
      <TimelinePanel
        sync={sync}
        playback={playback}
        lanes={timelineLanes()}
        testMaxMs={maxMs}
        minMs={timelineMinMs()}
        maxMs={timelineMaxMs()}
      />
    </div>
  );
}
