import { createAppStore } from "#app/state.ts";

/**
 * Live test stats, rendered by the Solid live stat displays (the mini and text
 * variants and the progress bar). The test engine is still vanilla, so it pushes
 * plain numbers in here as it goes; `components/live-stats` derives the display.
 * `undefined` means "no data yet" and is what the displays fall back to defaults on.
 */
export const [currentLiveStats, setCurrentLiveStats] = createAppStore<{
  wpm?: number;
  acc?: number;
  raw?: number;
  burst?: number;
  seconds?: number;
}>({});
