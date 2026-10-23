import type {
  TestEventNoMs,
  TestEventType,
} from "@oxytype/web-shared/events/types";

import { createEffect, For, JSXElement } from "solid-js";

import type { VideoSync } from "./createVideoSync";

import {
  EVENT_TYPES,
  getCurrentMs,
  getVisibleTypes,
  setVisibleTypes,
} from "../../../states/event-log-viewer";
import { cn } from "../../../utils/cn";
import { Button } from "../../common/Button";
import { EventMarkSelect } from "./EventMarkSelect";
import { scrollRowIntoView } from "./scroll-row";

export type EventRow = { event: TestEventNoMs; originalIndex: number };

export function EventsPanel(props: {
  sync: VideoSync;
  /** events of the visible types, with their index in the full log */
  rows: EventRow[];
  totalCount: number;
  /** row the playhead is on, -1 before the first one */
  currentEventIndex: number;
}): JSXElement {
  const currentMs = getCurrentMs;
  const visibleTypes = getVisibleTypes;

  const toggleType = (t: TestEventType): void => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  let eventsScrollEl: HTMLDivElement | undefined;

  createEffect(() => {
    scrollRowIntoView(eventsScrollEl, props.currentEventIndex);
  });

  return (
    <div class="bg-bg-secondary flex min-h-0 w-0 flex-[1.5] flex-col gap-2 rounded-lg p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="text-xs tracking-wider text-sub uppercase">
          Events ({props.rows.length}/{props.totalCount})
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
            <For each={props.rows}>
              {({ event, originalIndex }, i) => (
                <tr
                  data-row={i()}
                  class={cn(
                    "border-t border-bg",
                    i() === props.currentEventIndex && "bg-main/20",
                    event.testMs > currentMs() && "opacity-40",
                  )}
                >
                  <td class="p-2 text-right font-mono">
                    {event.testMs.toFixed(2)}
                  </td>
                  <td class="p-2 font-mono">{event.type}</td>
                  <td class="p-2">
                    <EventMarkSelect
                      sync={props.sync}
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
  );
}
