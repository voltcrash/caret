import { animate } from "animejs";
import {
  createEffect,
  createSignal,
  JSXElement,
  onCleanup,
  untrack,
} from "solid-js";

import {
  getBarAnimation,
  getMode,
  getText,
  isTextVisible,
} from "../../states/loading-page";
import { cn } from "../../utils/cn";
import { applyReducedMotion } from "../../utils/misc";
import { Fa } from "../common/Fa";
import { LOADER_WORD, TypingLoader } from "../common/TypingLoader";

export function LoadingPage(): JSXElement {
  // Progress percentage, typed out one letter per share of the word.
  const [getProgress, setProgress] = createSignal(0);
  const typed = (): number =>
    Math.floor((getProgress() / 100) * LOADER_WORD.length);

  createEffect(() => {
    const bar = getBarAnimation();
    if (bar === undefined) {
      setProgress(0);
      return;
    }
    const target = { percentage: untrack(getProgress) };
    const animation = animate(target, {
      percentage: bar.percentage,
      duration: applyReducedMotion(bar.duration),
      ease: "linear",
      onUpdate: () => setProgress(target.percentage),
      onComplete: () => {
        setProgress(bar.percentage);
        bar.onComplete();
      },
    });
    onCleanup(() => {
      animation.cancel();
      bar.onComplete();
    });
  });

  return (
    <div
      class="grid w-full justify-items-center gap-4 text-center"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={getMode() === "error" ? "Loading failed" : "Loading"}
    >
      <TypingLoader
        class={cn(
          "col-start-1 row-start-1 self-center",
          getMode() === "error" && "invisible",
        )}
        typed={getMode() === "bar" ? typed() : undefined}
      />
      <div
        class={cn(
          "col-start-1 row-start-1 h-8 text-[2rem] text-error",
          getMode() !== "error" && "invisible",
        )}
        aria-hidden="true"
      >
        <Fa icon="fa-times" fixedWidth />
      </div>
      <div
        class={cn(
          "row-start-2 min-h-[1.25em] w-full wrap-break-word",
          !isTextVisible() && "invisible",
        )}
      >
        {getText()}
      </div>
    </div>
  );
}
