import { createEffect, JSXElement, onCleanup, onMount } from "solid-js";

import { configEvent } from "../../../events/config";
import { useWordsFocus } from "../../../hooks/useWordsFocus";
import { getBackground } from "../../../states/background";
import { cn } from "../../../utils/cn";
import { cancelPendingAnimationFramesStartingWith } from "../../../utils/debounced-animation-frame";
import { onWordsConfigChange } from "./words/config";
import { setClass } from "./words/elements";
import { disposeWordRendering } from "./words/rendering";

// because of the requestAnimationFrame, multiple calls to updateWordLetters
// can be made before the actual update happens. This map keeps track of the
// latest input for each word and is used in before-insert-text to
// make sure the currently typed word will not overflow to the next line

// this is needed in tape mode because sometimes we want the newline character to appear above the next line
// and sometimes we want it to be shifted to the left
// (for example if the newline is typed incorrectly, or there are any extra letters after it)

// this means input, delete or composition

// D1: Solid owns this container; letter updates and positioning stay imperative.
export function Words(props: {
  ref: (element: HTMLDivElement) => void;
}): JSXElement {
  let element!: HTMLDivElement;
  onMount(() => {
    createEffect(() =>
      setClass(element, "noErrorBorder", getBackground().url !== ""),
    );
    useWordsFocus(element);
    configEvent.useListener(onWordsConfigChange);
    onCleanup(() => {
      cancelPendingAnimationFramesStartingWith("test-ui");
      disposeWordRendering();
    });
  });
  return (
    <div
      id="words"
      ref={(el) => {
        element = el;
        props.ref(el);
      }}
      class={cn(
        "full-width flex h-fit w-full flex-wrap content-start pb-[0.5em] select-none",
      )}
    ></div>
  );
}
