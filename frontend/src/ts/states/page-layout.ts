import { createAppSignal } from "../../app/state";

import type { PageName } from "../pages/page";

// long pages with a sticky sidebar. the header stays in place and only the
// page content scrolls, in its own scroll container, so overscroll (rubber
// banding) only moves the content
const fixedHeaderPages: PageName[] = ["settings"];

export function hasFixedHeader(page: PageName): boolean {
  return fixedHeaderPages.includes(page);
}

// bottom edge of the header in the viewport, so the content scroll container
// can start its content below it
export const [getHeaderBottom, setHeaderBottom] = createAppSignal(0);

// the element scrolling the page content, when it isn't the window
export const [getPageScroller, setPageScroller] = createAppSignal<
  HTMLElement | undefined
>();
