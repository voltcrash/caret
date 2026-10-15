import type { JSX } from "solid-js";

import { cn } from "../../ts/utils/cn";

/**
 * Page content + footer wrapper. Normally it takes their place in the app grid
 * and the window scrolls. On pages with a fixed header it becomes a full screen
 * scroll container under the header, so overscroll only moves the content and
 * the content scrolls under the header's soft edge.
 */
export function scrollerClass(fixed: boolean): string {
  return cn(
    "content-grid grid-rows-[1fr_auto] gap-y-8",
    // keep the scrollport full screen for the soft header edge
    fixed
      ? "fixed inset-0 z-10 grid-rows-[1fr] touch-manipulation overflow-y-auto overscroll-y-contain pr-[env(safe-area-inset-right,0px)] pb-[max(2rem,env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)] [&>main]:mt-(--content-top) [&>main]:h-auto"
      : "full-width row-[content-start/top-end]",
  );
}

/**
 * The header's bottom edge includes its own bottom padding (1rem), so this
 * keeps the usual 2rem gap between the header and the content.
 */
export function scrollerStyle(
  fixed: boolean,
  headerBottom: number,
): JSX.CSSProperties | undefined {
  return fixed
    ? { "--content-top": `calc(${headerBottom}px + 1rem)` }
    : undefined;
}

/** Initial `#app` grid from the legacy document. */
export const appClass =
  "content-grid focus min-h-dvh w-full grid-rows-[[top-start]_auto_[content-start]_1fr_[content-end]_auto_[top-end]] gap-y-8 overflow-clip pt-[max(2rem,env(safe-area-inset-top,0px))] pr-[env(safe-area-inset-right,0px)] pb-[max(2rem,env(safe-area-inset-bottom,0px))] pl-[env(safe-area-inset-left,0px)]";
