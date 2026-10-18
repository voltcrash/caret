import { JSXElement, onCleanup, onMount, Show } from "solid-js";

import { useRef } from "../../../hooks/useRef";
import { getIsScreenshotting } from "../../../states/core";
import { setHeaderBottom } from "../../../states/page-layout";
import { getFocus } from "../../../states/test";
import { cn } from "../../../utils/cn";
import { Logo } from "./Logo";
import { Nav } from "./Nav";

export function Header(props: { fixed: boolean }): JSXElement {
  const [ref, element] = useRef<HTMLElement>();
  const isFixed = (): boolean => props.fixed;

  // the page content scroll container starts its content below the header
  onMount(() => {
    const header = element();
    if (header === undefined) return;
    const update = (): void => {
      setHeaderBottom(header.getBoundingClientRect().bottom);
    };
    // body too: banners above the header move it without resizing it
    const observer = new ResizeObserver(update);
    // border box: switching pages changes the header's padding, not its content
    observer.observe(header, { box: "border-box" });
    observer.observe(document.body);
    onCleanup(() => observer.disconnect());
  });

  return (
    <header
      ref={ref}
      class={cn(
        "flex place-items-center gap-2",
        // a long press on the nav icons selects them instead of tapping
        "pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]",
        {
          "opacity-0": getIsScreenshotting(),
        },
        // above the page content scroll container. padded into #app's top
        // padding and the gap below it (negative margins keep the layout
        // unchanged) so its background covers the content scrolling under it
        isFixed() &&
          "relative z-20 -mt-[max(2rem,env(safe-area-inset-top,0px))] -mb-4 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-4",
      )}
      data-ui-element="header"
      data-focused={getFocus() ? "" : undefined}
    >
      <Show when={isFixed()}>
        {/* full width background, with a soft edge that fades out the content
            scrolling underneath */}
        <div class="pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 bg-bg"></div>
        <div class="pointer-events-none absolute top-full left-1/2 -z-10 h-8 w-screen -translate-x-1/2 bg-linear-to-b from-bg to-transparent"></div>
      </Show>
      <Logo />
      <Nav />
    </header>
  );
}
