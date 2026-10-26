import type { TestEventType } from "@caret/web-shared/events/types";

import { For, JSXElement, Show } from "solid-js";

import {
  getTimelineZoom,
  setTimelineZoom,
} from "../../../states/event-log-viewer";
import { cn } from "../../../utils/cn";
import {
  getNextTimelineZoom,
  TIMELINE_LANE_GAP,
  TIMELINE_TRACK_HEIGHT,
  type TimelineMark,
  type TimelineSegment,
  type VideoBar,
} from "./timeline-lanes";

const TYPE_BG: Record<TestEventType, string> = {
  keydown: "bg-text",
  keyup: "bg-error",
  input: "bg-main",
  timer: "bg-sub",
  composition: "bg-sub-alt",
};

export function Timeline(props: {
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
