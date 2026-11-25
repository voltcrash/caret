import { JSXElement, createEffect, onCleanup } from "solid-js";

import { applyReducedMotion } from "#shared/utils/misc.ts";

import {
  FunboxTimerVisibility,
  getLayoutfluidTimerText,
  getLayoutfluidTimerVisibility,
  getMemoryTimerText,
  getMemoryTimerVisibility,
} from "../runtime/funbox/timers-state";

function FunboxTimer(props: {
  id: string;
  text: string;
  visibility: FunboxTimerVisibility;
}): JSXElement {
  let el: HTMLDivElement | undefined;
  let animation: Animation | undefined;

  createEffect(() => {
    const visibility = props.visibility;
    if (el === undefined) return;

    if (animation !== undefined) {
      if (animation.playState !== "finished") {
        try {
          animation.commitStyles();
        } catch {
          // Unrendered elements fall back to inline/computed opacity.
        }
      }
      animation.cancel();
      animation = undefined;
    }

    const from = el.style.opacity || getComputedStyle(el).opacity || "0";
    const to = visibility === "shown" ? "1" : "0";
    const duration = visibility === "instant" ? 0 : applyReducedMotion(125);
    el.style.opacity = to;

    if (duration > 0 && from !== to) {
      animation = el.animate(
        { opacity: [from, to] },
        { duration, easing: "ease-out" },
      );
    }
  });

  onCleanup(() => {
    animation?.cancel();
    animation = undefined;
  });

  return (
    <div
      ref={(e) => (el = e)}
      id={props.id}
      class="pointer-events-none absolute -top-24 left-1/2 col-[content] w-max max-w-full -translate-x-1/2 rounded-(--roundness) bg-main p-4 text-center text-[1rem] text-bg opacity-0 select-none"
    >
      {props.text}
    </div>
  );
}

export function FunboxTimers(): JSXElement {
  return (
    <>
      <FunboxTimer
        id="memoryTimer"
        text={getMemoryTimerText()}
        visibility={getMemoryTimerVisibility()}
      />
      <FunboxTimer
        id="layoutfluidTimer"
        text={getLayoutfluidTimerText()}
        visibility={getLayoutfluidTimerVisibility()}
      />
    </>
  );
}
