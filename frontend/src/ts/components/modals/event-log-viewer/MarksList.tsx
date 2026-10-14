import { For, JSXElement, Show } from "solid-js";

import type { VideoSync } from "./createVideoSync";

import { Button } from "../../common/Button";
import { unassignedMarks } from "./video-sync";

/**
 * Mark controls under the video, plus every mark not yet assigned to an event.
 * Assigned marks are edited from the events table instead.
 */
export function MarksList(props: { sync: VideoSync }): JSXElement {
  return (
    <div class="flex flex-wrap items-center gap-2 border-t border-bg pt-2">
      <div class="text-xs tracking-wider text-sub uppercase">Marks</div>
      <Button
        variant="text"
        text="+ mark"
        class="text-xs"
        disabled={!props.sync.isSynced()}
        balloon={{
          text: props.sync.isSynced()
            ? "Add a generic mark at the current video frame"
            : "Add and assign both sync marks first",
        }}
        onClick={() => props.sync.addMark()}
      />
      <Button
        variant="text"
        text="+ start sync"
        class="text-xs"
        disabled={props.sync.syncStartMark() !== undefined}
        balloon={{
          text: "Add the start sync mark at the current video frame",
        }}
        onClick={() => props.sync.addMark("start")}
      />
      <Button
        variant="text"
        text="+ end sync"
        class="text-xs"
        disabled={props.sync.syncEndMark() !== undefined}
        balloon={{
          text: "Add the end sync mark at the current video frame",
        }}
        onClick={() => props.sync.addMark("end")}
      />
      <Show
        when={
          unassignedMarks(props.sync.marks(), props.sync.eventToMark()).length >
          0
        }
      >
        <For
          each={unassignedMarks(props.sync.marks(), props.sync.eventToMark())}
        >
          {(mark) => (
            <div class="flex items-center gap-1 rounded bg-bg p-1 font-mono text-xs">
              <span class="text-text">{mark.sync ?? mark.id}</span>
              <input
                aria-label={`Video time for mark ${mark.id}`}
                type="number"
                value={mark.videoMs}
                onInput={(e) =>
                  props.sync.updateMarkVideoMs(
                    mark.id,
                    Number(e.currentTarget.value),
                  )
                }
                class="bg-bg-secondary w-20 rounded p-1 text-text"
              />
              <button
                type="button"
                class="cursor-pointer px-1 text-error"
                onClick={() => props.sync.removeMark(mark.id)}
                title="Remove mark"
              >
                ×
              </button>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
