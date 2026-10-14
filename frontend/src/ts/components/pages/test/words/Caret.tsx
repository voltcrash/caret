import { JSXElement, onCleanup, onMount } from "solid-js";

import { bindCaret as bindMainCaret } from "../../../../test/caret";
import { bindCaret as bindPaceCaret } from "../../../../test/pace-caret";
import { cn } from "../../../../utils/cn";

export function Caret(props: {
  pace?: boolean;
  ref: (el: HTMLDivElement) => void;
}): JSXElement {
  let element!: HTMLDivElement;
  onMount(() => {
    const dispose = (props.pace ? bindPaceCaret : bindMainCaret)(element);
    onCleanup(dispose);
  });

  return (
    <div
      id={props.pace ? "paceCaret" : "caret"}
      ref={(el) => {
        element = el;
        props.ref(el);
      }}
      class={cn(
        "full-width default absolute h-[1.2em] origin-top-left rounded-(--roundness)",
        props.pace
          ? "hidden bg-sub opacity-50 [&.outline]:[animation:caretFlashSmooth_1s_infinite]"
          : "[animation:caretFlashSmooth_1s_infinite] bg-caret",
        "[&.default]:w-[0.1em] [&.off]:w-0",
        "[&.carrot]:w-[0.25em] [&.carrot]:bg-transparent [&.carrot]:bg-[url('/images/caret/carrot.png')]",
        "[&.banana]:w-[1em] [&.banana]:bg-transparent [&.banana]:bg-[url('/images/caret/banana.png')]",
        "[&:is(.carrot,.banana)]:bg-contain [&:is(.carrot,.banana)]:bg-center [&:is(.carrot,.banana)]:bg-no-repeat",
        "[&:is(.block,.outline)]:-z-1 [&:is(.block,.outline)]:w-[0.5em] [&:is(.block,.outline)]:rounded-[0.05em]",
        "[&.outline]:border-[0.05em] [&.outline]:border-caret [&.outline]:bg-transparent [&.outline]:outline-none! [&.outline]:[animation-name:none]",
        "[&.underline]:h-[0.1em] [&.underline]:w-[0.5em]",
      )}
    ></div>
  );
}
