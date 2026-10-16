import { animate } from "animejs";
import { JSXElement, Show } from "solid-js";

import { Fa } from "../../../../ts/components/common/Fa";
import {
  resultState,
  type ResultCrownType,
} from "../../../../ts/states/result";
import { cn } from "../../../../ts/utils/cn";
import { applyReducedMotion } from "../../../../ts/utils/misc";

// --main = crown background, --alt = icon color
const typeClass: Record<ResultCrownType, string> = {
  normal: "[--alt:var(--bg-color)] [--main:var(--main-color)]",
  pending:
    "outline-[0.2em] outline-main [--alt:var(--main-color)] [--main:var(--bg-color)]",
  ineligible: "[--alt:var(--bg-color)] [--main:var(--sub-color)]",
  error: "[--alt:var(--bg-color)] [--main:var(--error-color)]",
  warning: "[--alt:var(--bg-color)] [--main:var(--sub-color)]",
};

export function ResultCrown(): JSXElement {
  const crown = () => resultState.crown;
  const is = (...types: ResultCrownType[]): boolean =>
    types.includes(crown().type);

  return (
    <Show when={crown().visible}>
      <div
        ref={(el) => {
          animate(el, {
            opacity: [0, 1],
            duration: applyReducedMotion(125),
          });
        }}
        class={cn(
          "crown -mt-[0.2rem] ml-2 grid h-[1.7rem] w-[1.7rem] items-center justify-items-center rounded-(--roundness) bg-(--main) text-[0.7rem] text-(--alt) transition-[opacity,background,color,outline] duration-125 ease-[ease] [grid-template-areas:'icon']",
          crown().type,
          typeClass[crown().type],
        )}
        aria-label={crown().text}
        data-balloon-pos="up"
        data-balloon-length={crown().wide ? "medium" : ""}
      >
        <Fa
          icon="fa-question"
          class={cn(
            "text-(--alt) opacity-0 [grid-area:icon]",
            is("error") && "opacity-100",
          )}
        />
        <Fa
          icon="fa-crown"
          class={cn("[grid-area:icon]", is("error", "warning") && "opacity-0")}
        />
        <Fa
          icon="fa-slash"
          class={cn(
            "text-[1.2rem] text-(--main) opacity-0 [grid-area:icon]",
            is("ineligible") && "opacity-100",
          )}
        />
        <Fa
          icon="fa-exclamation-triangle"
          class={cn(
            "text-(--alt) opacity-0 [grid-area:icon]",
            is("warning") && "opacity-100",
          )}
        />
      </div>
    </Show>
  );
}
