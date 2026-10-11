import { createEffect, JSXElement, onCleanup, ParentProps } from "solid-js";

import { useRef } from "../../hooks/useRef";
import { getActivePage } from "../../states/core";
import {
  getHeaderBottom,
  hasFixedHeader,
  setPageScroller,
} from "../../states/page-layout";
import { isTestActive } from "../../states/test";
import { cn } from "../../utils/cn";

// wraps the page content and footer. normally it takes their place in the app
// grid and the window scrolls. on pages with a fixed header it becomes a full
// screen scroll container underneath the header instead, so overscroll only
// moves the content and the content scrolls under the header's soft edge
export function PageScroller(props: ParentProps): JSXElement {
  const [ref, element] = useRef<HTMLDivElement>();
  const isScroller = (): boolean => hasFixedHeader(getActivePage());

  createEffect(() => {
    setPageScroller(isScroller() ? element() : undefined);
  });

  // the window no longer scrolls on these pages, so don't let it rubber band.
  // during a test a stray swipe must not pull to refresh and lose the run
  createEffect(() => {
    document.documentElement.style.overscrollBehaviorY =
      isScroller() || isTestActive() ? "none" : "";
  });

  onCleanup(() => {
    setPageScroller(undefined);
    document.documentElement.style.overscrollBehaviorY = "";
  });

  return (
    <div
      ref={ref}
      class={cn(
        "content-grid grid-rows-[1fr_auto] gap-y-8",
        // keep the scrollport full screen for the soft header edge
        isScroller()
          ? "fixed inset-0 z-10 grid-rows-[1fr] overflow-y-auto overscroll-y-contain pr-[env(safe-area-inset-right,0px)] pb-[max(2rem,env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] [&>main]:mt-(--content-top) [&>main]:h-auto"
          : "full-width row-[content-start/top-end]",
      )}
      // the header's bottom edge includes its own bottom padding (1rem), so
      // this keeps the usual 2rem gap between the header and the content
      style={
        isScroller()
          ? { "--content-top": `calc(${getHeaderBottom()}px + 1rem)` }
          : undefined
      }
    >
      {props.children}
    </div>
  );
}
