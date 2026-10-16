import { animate } from "animejs";
import { JSXElement, createEffect } from "solid-js";

import {
  FunboxTimerVisibility,
  getLayoutfluidTimerText,
  getLayoutfluidTimerVisibility,
  getMemoryTimerText,
  getMemoryTimerVisibility,
} from "../../../ts/states/funbox-timers";
import { applyReducedMotion } from "../../../ts/utils/misc";

function FunboxTimer(props: {
  id: string;
  text: string;
  visibility: FunboxTimerVisibility;
}): JSXElement {
  let el: HTMLDivElement | undefined;

  createEffect(() => {
    const visibility = props.visibility;
    if (el === undefined) return;
    animate(el, {
      opacity: visibility === "shown" ? 1 : 0,
      duration: visibility === "instant" ? 0 : applyReducedMotion(125),
    });
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
