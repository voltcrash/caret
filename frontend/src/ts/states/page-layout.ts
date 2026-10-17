import { createAppSignal } from "../../app/state";

// bottom edge of the header in the viewport, so the content scroll container
// can start its content below it
export const [getHeaderBottom, setHeaderBottom] = createAppSignal(0);

// the element scrolling the page content, when it isn't the window
export const [getPageScroller, setPageScroller] = createAppSignal<
  HTMLElement | undefined
>();
