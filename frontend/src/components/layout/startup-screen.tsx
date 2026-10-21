import { createEffect, type JSXElement } from "solid-js";

import { TypingLoader } from "../../ts/components/common/TypingLoader";
import { cn } from "../../ts/utils/cn";

/**
 * Server-rendered cover while chrome, preferences and the initial typing test
 * load. Fades out once `leaving`, accepting input during the fade.
 */
export function StartupScreen(props: {
  leaving: boolean;
  onFinished: () => void;
}): JSXElement {
  createEffect(() => {
    // Reduced motion disables the animation, so no animationend follows.
    if (props.leaving && matchMedia("(prefers-reduced-motion)").matches) {
      props.onFinished();
    }
  });
  return (
    <div
      id="startupScreen"
      class={cn(
        "fixed inset-0 z-9999 grid grid-cols-1 place-items-center bg-bg px-8",
        props.leaving &&
          "pointer-events-none animate-[fadeOut_150ms_ease_forwards]",
      )}
      role="status"
      aria-live="polite"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) props.onFinished();
      }}
    >
      <TypingLoader />
      <span class="sr-only">Loading Oxytype</span>
    </div>
  );
}
