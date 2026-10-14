import { For, JSXElement, Show } from "solid-js";

import type { VideoSync } from "./createVideoSync";

import { marksForEvent } from "./video-sync";

/**
 * Assigns a mark to one event, or creates one for it on the spot. The select
 * is reset to the stored assignment after every change, since a create can
 * be refused.
 */
export function EventMarkSelect(props: {
  sync: VideoSync;
  /** index into the full log's events, not the filtered rows */
  eventIndex: number;
}): JSXElement {
  return (
    <select
      aria-label={`Sync mark for event ${props.eventIndex + 1}`}
      class="w-full rounded bg-bg p-1 font-mono text-xs text-text"
      value={props.sync.eventToMark()[props.eventIndex] ?? ""}
      onChange={(e) => {
        const v = e.currentTarget.value;
        if (v === "") {
          props.sync.assignMarkToEvent(props.eventIndex, null);
        } else if (v === "__new__") {
          props.sync.createMarkAndAssignToEvent(props.eventIndex);
        } else if (v === "__new_start__") {
          props.sync.createSyncMarkAndAssignToEvent(props.eventIndex, "start");
        } else if (v === "__new_end__") {
          props.sync.createSyncMarkAndAssignToEvent(props.eventIndex, "end");
        } else {
          props.sync.assignMarkToEvent(props.eventIndex, v);
        }
        e.currentTarget.value =
          props.sync.eventToMark()[props.eventIndex] ?? "";
      }}
    >
      <option value="">(none)</option>
      <For
        each={marksForEvent(
          props.sync.marks(),
          props.sync.eventToMark(),
          props.eventIndex,
        )}
      >
        {(mark) => (
          <option value={mark.id}>
            {mark.sync ?? mark.id} ({mark.videoMs.toFixed(0)}
            ms)
          </option>
        )}
      </For>
      <Show
        when={
          props.sync.videoUrl() !== null &&
          props.sync.syncStartMark() === undefined
        }
      >
        <option value="__new_start__">+ start sync mark @ frame</option>
      </Show>
      <Show
        when={
          props.sync.videoUrl() !== null &&
          props.sync.syncEndMark() === undefined
        }
      >
        <option value="__new_end__">+ end sync mark @ frame</option>
      </Show>
      <Show when={props.sync.isSynced()}>
        <option value="__new__">+ new mark at playhead</option>
      </Show>
    </select>
  );
}
