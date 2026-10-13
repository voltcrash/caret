import { Accessor, createMemo, createSignal, onCleanup } from "solid-js";

import type { TestEventNoMs } from "../../../test/events/types";
import type { VideoSync } from "./createVideoSync";

import { getCurrentMs, setCurrentMs } from "../../../states/event-log-viewer";
import { getNextEventMs, getPreviousEventMs } from "./event-log";

export type Playback = {
  playing: Accessor<boolean>;
  togglePlay: () => void;
  step: (delta: number) => void;
  goToStart: () => void;
  goToEnd: () => void;
  goNextEvent: () => void;
  goPrevEvent: () => void;
};

/**
 * Moves the playhead. Unsynced it animates on its own clock; synced it drives
 * the video instead and the video's timeupdate moves the playhead.
 */
export function createPlayback(options: {
  sync: VideoSync;
  /** events the prev/next buttons step between */
  events: Accessor<TestEventNoMs[]>;
  minMs: Accessor<number>;
  maxMs: Accessor<number>;
}): Playback {
  const { videoEl, videoPlayState, isSynced } = options.sync;
  const filteredEvents = options.events;
  const timelineMinMs = options.minMs;
  const timelineMaxMs = options.maxMs;
  const currentMs = getCurrentMs;

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

  return {
    playing,
    togglePlay,
    step,
    goToStart,
    goToEnd,
    goNextEvent,
    goPrevEvent,
  };
}
