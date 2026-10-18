import { JSXElement, createSignal, onMount, onCleanup } from "solid-js";

import { useTypingRoute } from "../../../../components/typing-route-host";
import { createEffectOn } from "../../../hooks/effects";
import { getPageScroller } from "../../../states/page-layout";
import { cn } from "../../../utils/cn";
import { applyReducedMotion } from "../../../utils/misc";
import { Fa } from "../../common/Fa";

export function ScrollToTop(): JSXElement {
  const typing = useTypingRoute();
  const [visible, setVisible] = createSignal(false);

  const handleScroll = (): void => {
    if (typing()) return;

    // some pages scroll their content in their own container instead
    const scroll = getPageScroller()?.scrollTop ?? window.scrollY;
    setVisible(scroll > 100);
  };

  onMount(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
  });

  onCleanup(() => {
    window.removeEventListener("scroll", handleScroll);
  });

  createEffectOn(getPageScroller, (scroller) => {
    handleScroll();
    if (scroller === undefined) return;
    scroller.addEventListener("scroll", handleScroll, { passive: true });
    onCleanup(() => scroller.removeEventListener("scroll", handleScroll));
  });

  return (
    <div class="content-grid ScrollToTop pointer-events-none fixed top-0 left-0 z-999999 h-full w-full">
      <button
        aria-label="Scroll to top"
        class={cn(
          "breakout pointer-events-auto mb-[max(2rem,calc(env(safe-area-inset-bottom,0px)+1rem))] grid h-12 w-12 place-self-end rounded-full bg-sub-alt text-[1.5rem] text-sub ring-4 ring-bg hover:bg-text hover:text-bg sm:h-16 sm:w-16 sm:text-[2rem] sm:ring-8",
          (typing() || !visible()) && "pointer-events-none opacity-0",
        )}
        style={{
          "grid-column": "content-end/breakout-end",
        }}
        disabled={typing() || !visible()}
        aria-hidden={typing() || !visible()}
        type="button"

        onClick={() => {
          setVisible(false);
          (getPageScroller() ?? window).scrollTo({
            top: 0,
            behavior: applyReducedMotion(1) === 0 ? "auto" : "smooth",
          });
        }}
      >
        <Fa icon="fa-angle-double-up" />
      </button>
    </div>
  );
}
