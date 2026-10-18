import { createEffect, JSXElement, onCleanup, onMount } from "solid-js";

import { configEvent } from "../../../ts/events/config";
import { useWordsFocus } from "../../../ts/hooks/useWordsFocus";
import { getBackground } from "../../../ts/states/background";
import { cn } from "../../../ts/utils/cn";
import { cancelPendingAnimationFramesStartingWith } from "../../../ts/utils/debounced-animation-frame";
import { onWordsConfigChange } from "./words/config";
import { setClass } from "./words/elements";
import { disposeWordRendering } from "./words/rendering";

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
