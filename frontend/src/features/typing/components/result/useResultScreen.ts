import { captureTypingRoute } from "../../scope";
import { Accessor, createEffect, onCleanup, onMount } from "solid-js";

import { animateAsync } from "../../../../ts/anim";
import { getIsScreenshotting } from "../../../../ts/states/core";
import { updateClassNames } from "../../../../ts/utils/cn";

let show: ((duration: number) => Promise<void>) | undefined;

export async function showResultScreen(duration: number): Promise<void> {
  await show?.(duration);
}

export function useResultScreen(
  element: Accessor<HTMLElement | undefined>,
): void {
  onMount(() => {
    const showScreen = async (duration: number): Promise<void> => {
      const lease = captureTypingRoute();
      const result = element();
      if (result) {
        result.className = updateClassNames(result.className, "hidden", false);
        result.focus({ preventScroll: true });
      }
      await animateAsync(result, { opacity: [0, 1], duration });
      if (!lease.isCurrent()) return;
      result?.scrollIntoView({
        block: result.offsetHeight < window.innerHeight ? "center" : "start",
      });
    };
    show = showScreen;
    createEffect(() => {
      const result = element();
      const screenshotting = getIsScreenshotting();
      if (result) {
        result.className = updateClassNames(
          result.className,
          "noBalloons",
          screenshotting,
        );
      }
    });
    onCleanup(() => {
      if (show === showScreen) show = undefined;
    });
  });
}
