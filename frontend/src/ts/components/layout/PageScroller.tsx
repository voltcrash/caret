import { createEffect, JSXElement, onCleanup, ParentProps } from "solid-js";

import {
  scrollerClass,
  scrollerStyle,
} from "../../../components/layout/scroller";
import { useRef } from "../../hooks/useRef";
import { getHeaderBottom, setPageScroller } from "../../states/page-layout";
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

export function PageScroller(
  props: ParentProps<{ fixed: boolean }>,
): JSXElement {
  const [ref, element] = useRef<HTMLDivElement>();
  usePageScroller(element, () => props.fixed);

  return (
    <div
      ref={ref}
      class={scrollerClass(props.fixed)}
      style={scrollerStyle(props.fixed, getHeaderBottom())}
    >
      {props.children}
    </div>
  );
}
