import { JSXElement, onCleanup, onMount } from "solid-js";

import { areTestElementsMounted } from "#features/typing/state/test-dom.ts";
import { peekConfig } from "#shared/config/store.ts";
import { configEvent } from "#shared/events/config.ts";
import { cn } from "#shared/utils/cn.ts";

import {
  setCaret as setMainCaret,
  updatePosition as updateMainCaretPosition,
} from "../../runtime/caret";
import { setCaret as setPaceCaret } from "../../runtime/pace-caret";
import { CaretController } from "./caret-controller";

export function Caret(props: {
  pace?: boolean;
  ref: (el: HTMLDivElement) => void;
}): JSXElement {
  let element!: HTMLDivElement;
  onMount(() => {
    const pace = props.pace === true;
    const controller = new CaretController(
      element,
      pace ? peekConfig().paceCaretStyle : peekConfig().caretStyle,
    );
    const unregister = (pace ? setPaceCaret : setMainCaret)(controller);
    const clearGeometry = (): void => controller.clearGeometry();
    window.addEventListener("resize", clearGeometry);
    document.fonts.addEventListener("loadingdone", clearGeometry);
    const unsubscribe = configEvent.subscribe(({ key }) => {
      controller.clearGeometry();
      if (!areTestElementsMounted()) return;
      if (pace) {
        if (key === "paceCaretStyle") {
          controller.setStyle(peekConfig().paceCaretStyle);
        }
        return;
      }
      if (key === "caretStyle") {
        controller.setStyle(peekConfig().caretStyle);
        updateMainCaretPosition(true);
      }
      if (key === "smoothCaret") controller.updateBlinkingAnimation();
    });
    onCleanup(() => {
      unsubscribe();
      window.removeEventListener("resize", clearGeometry);
      document.fonts.removeEventListener("loadingdone", clearGeometry);
      controller.stopAllAnimations();
      controller.cancelPendingMove();
      unregister();
    });
  });

  return (
    <div
      id={props.pace ? "paceCaret" : "caret"}
      ref={(el) => {
        element = el;
        props.ref(el);
      }}
      class={cn(
        "full-width default absolute top-0 left-0 h-[1.2em] origin-top-left rounded-(--roundness) will-change-[translate]",
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
