import { JSXElement, Show } from "solid-js";

import type { VideoSync } from "./createVideoSync";

import { setCurrentMs } from "../../../states/event-log-viewer";
import { Button } from "../../common/Button";
import { MarksList } from "./MarksList";

/**
 * The loaded video with frame stepping and the sync toggle. While synced the
 * video's own time drives the playhead.
 */
export function VideoPanel(props: { sync: VideoSync }): JSXElement {
  return (
    <div class="bg-bg-secondary flex min-h-0 w-0 flex-1 flex-col gap-2 overflow-auto rounded-lg p-3">
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs tracking-wider text-sub uppercase">Viewer</div>
        <div class="flex items-center gap-2">
          <input
            type="file"
            accept="video/*"
            onChange={(e) => props.sync.onPickVideo(e)}
            class="text-xs text-text"
          />
          <Show when={props.sync.videoUrl() !== null}>
            <Button
              variant="text"
              text="Clear"
              class="text-xs"
              onClick={props.sync.clearVideo}
            />
          </Show>
        </div>
      </div>
      <Show
        when={props.sync.videoUrl() !== null}
        fallback={
          <div class="flex h-64 items-center justify-center rounded bg-bg text-xs text-sub">
            No video loaded
          </div>
        }
      >
        <div class="flex justify-center">
          <video
            ref={(el) => props.sync.setVideoEl(el)}
            src={props.sync.videoUrl() ?? undefined}
            class="max-h-[60vh] w-full max-w-3xl rounded bg-bg object-contain"
            muted
            onLoadedMetadata={(e) =>
              props.sync.setVideoDurationMs(e.currentTarget.duration * 1000)
            }
            onPlay={() => props.sync.setVideoPlayState(true)}
            onPause={() => props.sync.setVideoPlayState(false)}
            onTimeUpdate={(e) => {
              const ct = e.currentTarget.currentTime * 1000;
              props.sync.setVideoCurrentMs(ct);
              if (props.sync.isSynced()) {
                setCurrentMs(props.sync.videoMsToTestMs(ct));
              }
            }}
          ></video>
        </div>
        <input
          type="range"
          min="0"
          max={props.sync.videoDurationMs() ?? 0}
          step="1"
          value={props.sync.videoCurrentMs()}
          onInput={(e) => props.sync.seekVideoMs(Number(e.currentTarget.value))}
          class="w-full"
        />
        <div class="flex items-center justify-between gap-2">
          <div
            class="font-mono text-xs text-sub"
            title="current video frame index / time @ detected fps"
          >
            {props.sync.currentFrameIndex() !== null
              ? `${props.sync.currentFrameIndex()} (${(props.sync.videoFrameTimeMs() ?? 0).toFixed(2)}ms @ ${props.sync.videoFps().toFixed(2)}fps)`
              : "—"}
          </div>
          <div class="flex items-center gap-1">
            <Button
              variant="text"
              balloon={{ text: "Previous frame" }}
              fa={{ icon: "fa-step-backward" }}
              onClick={() => props.sync.videoStepFrame(-1)}
            />
            <Button
              variant="button"
              balloon={{ text: props.sync.videoPlayState() ? "Pause" : "Play" }}
              fa={{
                icon: props.sync.videoPlayState() ? "fa-pause" : "fa-play",
              }}
              onClick={props.sync.toggleVideoPlay}
            />
            <Button
              variant="text"
              balloon={{ text: "Next frame" }}
              fa={{ icon: "fa-step-forward" }}
              onClick={() => props.sync.videoStepFrame(1)}
            />
          </div>
          <Button
            variant="button"
            text={props.sync.isSynced() ? "Synced" : "Sync"}
            active={props.sync.isSynced()}
            disabled={!props.sync.isSyncable()}
            balloon={{
              text: props.sync.isSyncable()
                ? props.sync.isSynced()
                  ? "Click to unsync"
                  : "Lock video to timeline"
                : "Both sync marks must be placed and assigned to events",
            }}
            onClick={props.sync.toggleSync}
          />
        </div>
      </Show>
      <Show when={props.sync.videoUrl() !== null}>
        <MarksList sync={props.sync} />
      </Show>
    </div>
  );
}
