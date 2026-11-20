import { createBinding } from "#app/binding.ts";
import { captureTypingPresentation } from "../../scope";
import { Accessor, createEffect, onCleanup, onMount } from "solid-js";

import { animateAsync } from "#shared/anim.ts";
import { getIsScreenshotting } from "#shared/states/core.ts";
import { updateClassNames } from "#shared/utils/cn.ts";

const show = createBinding<(duration: number) => Promise<void>>();

export async function showResultScreen(duration: number): Promise<void> {
  await show.get()?.(duration);
}

export function useResultScreen(
  element: Accessor<HTMLElement | undefined>,
): void {
  onMount(() => {
    const showScreen = async (duration: number): Promise<void> => {
      const lease = captureTypingPresentation();
      const result = element();
      if (result) {
        result.className = updateClassNames(result.className, "hidden", false);
      }
      await animateAsync(result, { opacity: [0, 1], duration });
      if (!lease.isCurrent()) return;
      result?.scrollIntoView({
        block: result.offsetHeight < window.innerHeight ? "center" : "start",
      });
      // Restart stays guarded during the reveal. Focus only once keyboard
      // users can Tab to Next test and activate it without losing the action.
      result?.focus({ preventScroll: true });
    };
    const release = show.bind(showScreen);
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
    onCleanup(release);
  });
}
