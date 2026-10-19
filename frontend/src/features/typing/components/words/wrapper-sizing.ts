import { onCleanup } from "solid-js";

import { updateWordsWrapperHeight } from "./sizing";
import {
  cancelPendingAnimationFrame,
  requestDebouncedAnimationFrame,
} from "../../../../ts/utils/debounced-animation-frame";

const FRAME_ID = "test-ui.updateWordsWrapperHeight";

/** Re-measures the visible lines whenever the words reflow. */
export function useWordsWrapperSizing(wrapper: HTMLElement): void {
  const remeasure = (): void =>
    requestDebouncedAnimationFrame(FRAME_ID, () =>
      updateWordsWrapperHeight(true),
    );

  // a new width reflows the words; going from 0 means they just got layout
  let width: number | undefined;
  const observer = new ResizeObserver(([entry]) => {
    const next = entry?.contentRect.width;
    if (next === width) return;
    width = next;
    remeasure();
  });
  observer.observe(wrapper);

  onCleanup(() => {
    observer.disconnect();
    cancelPendingAnimationFrame(FRAME_ID);
  });
}
