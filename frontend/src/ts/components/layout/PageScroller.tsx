import { createEffect, onCleanup } from "solid-js";

import { setPageScroller } from "../../states/page-layout";
import { isTestActive } from "../../states/test";

/** Registers the page scroll container and guards overscroll for the app. */
export function usePageScroller(
  element: () => HTMLElement | undefined,
  fixed: () => boolean,
): void {
  createEffect(() => {
    setPageScroller(fixed() ? element() : undefined);
  });

  // the window no longer scrolls on these pages, so don't let it rubber band.
  // during a test a stray swipe must not pull to refresh and lose the run
  createEffect(() => {
    document.documentElement.style.overscrollBehaviorY =
      fixed() || isTestActive() ? "none" : "";
  });

  onCleanup(() => {
    setPageScroller(undefined);
    document.documentElement.style.overscrollBehaviorY = "";
  });
}
