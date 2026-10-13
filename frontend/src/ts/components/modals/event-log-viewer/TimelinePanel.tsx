import { JSXElement, Show } from "solid-js";

import type { Playback } from "./createPlayback";
import type { VideoSync } from "./createVideoSync";
import type { TimelineSegment } from "./timeline-lanes";

import { getCurrentMs, setCurrentMs } from "../../../states/event-log-viewer";
import { Button } from "../../common/Button";
import { DriftChart } from "./DriftChart";
import { Timeline } from "./Timeline";

/** transport controls, the drift chart and the timeline track */
export function TimelinePanel(props: {
  sync: VideoSync;
  playback: Playback;
  lanes: { segments: TimelineSegment[]; totalHeight: number };
  /** last event of the test, for the readout */
  testMaxMs: number;
  /** visible range, padded and widened to fit the video */
  minMs: number;
  maxMs: number;
}): JSXElement {
  const currentMs = getCurrentMs;

  return (
    <div class="bg-bg-secondary flex shrink-0 flex-col gap-2 rounded-lg p-3">
      <div class="flex items-center justify-between">
        <div class="text-xs tracking-wider text-sub uppercase">Timeline</div>
        <div class="font-mono text-xs text-sub">
          {currentMs().toFixed(2)} / {props.testMaxMs} ms
        </div>
      </div>
      <div class="flex items-center justify-center gap-1">
        <Button
          variant="text"
          balloon={{ text: "Go to start" }}
          fa={{ icon: "fa-fast-backward" }}
          onClick={props.playback.goToStart}
        />
        <Button
          variant="text"
          balloon={{ text: "-10ms" }}
          fa={{ icon: "fa-backward" }}
          onClick={() => props.playback.step(-10)}
        />
        <Button
          variant="text"
          balloon={{ text: "-1ms" }}
          fa={{ icon: "fa-chevron-left" }}
          onClick={() => props.playback.step(-1)}
        />
        <Button
          variant="text"
          balloon={{ text: "Previous event" }}
          fa={{ icon: "fa-step-backward" }}
          onClick={props.playback.goPrevEvent}
        />
        <Button
          variant="button"
          balloon={{ text: props.playback.playing() ? "Pause" : "Play" }}
          fa={{ icon: props.playback.playing() ? "fa-pause" : "fa-play" }}
          onClick={props.playback.togglePlay}
        />
        <Button
          variant="text"
          balloon={{ text: "Next event" }}
          fa={{ icon: "fa-step-forward" }}
          onClick={props.playback.goNextEvent}
        />
        <Button
          variant="text"
          balloon={{ text: "+1ms" }}
          fa={{ icon: "fa-chevron-right" }}
          onClick={() => props.playback.step(1)}
        />
        <Button
          variant="text"
          balloon={{ text: "+10ms" }}
          fa={{ icon: "fa-forward" }}
          onClick={() => props.playback.step(10)}
        />
        <Button
          variant="text"
          balloon={{ text: "Go to end" }}
          fa={{ icon: "fa-fast-forward" }}
          onClick={props.playback.goToEnd}
        />
      </div>
      <Show when={props.sync.driftData().length > 0}>
        <DriftChart
          data={props.sync.driftData()}
          minMs={props.minMs}
          maxMs={props.maxMs}
        />
      </Show>
      <Timeline
        segments={props.lanes.segments}
        totalHeight={props.lanes.totalHeight}
        minMs={props.minMs}
        maxMs={props.maxMs}
        currentMs={currentMs()}
        onSeek={setCurrentMs}
        videoBar={props.sync.videoBarRange()}
        marks={props.sync.timelineMarks()}
      />
    </div>
  );
}
