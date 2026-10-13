import type { EventLog } from "@oxytype/typing-core/events/types";

import {
  createDeferred,
  createMemo,
  JSXElement,
  Show,
  untrack,
} from "solid-js";

import {
  getCurrentMs,
  getVisibleTypes,
} from "../../../states/event-log-viewer";
import { Button } from "../../common/Button";
import { createPlayback } from "./createPlayback";
import { createVideoSync } from "./createVideoSync";
import { DistributionPanel } from "./DistributionPanel";
import {
  getCurrentEventIndex,
  getCurrentWordIndex,
  getMaxTestMs,
  inputsPerWord,
  visualizeWhitespace,
} from "./event-log";
import { EventsPanel } from "./EventsPanel";
import { ScatterPanel } from "./ScatterPanel";
import { SimulatedInputPanel } from "./SimulatedInputPanel";
import {
  buildLanes,
  getTimelineMaxMs,
  getTimelineMinMs,
} from "./timeline-lanes";
import { TimelinePanel } from "./TimelinePanel";
import { VideoPanel } from "./VideoPanel";
import { WordsPanel } from "./WordsPanel";

export function PreviewContent(props: {
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
