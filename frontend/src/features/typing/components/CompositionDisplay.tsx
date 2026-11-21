import { Show } from "solid-js";

import { getCompositionText } from "#features/typing/state/composition.ts";
import { getConfig } from "#shared/config/store.ts";
import { testFocusState } from "#shared/states/test.ts";
import { cn } from "#shared/utils/cn.ts";

import { getWordsFontSize } from "./words/font";

export function CompositionDisplay() {
  const isOutOfFocus = () => testFocusState() !== "focused";
  return (
    <Show when={getConfig.compositionDisplay === "below"}>
      <div
        class={cn("mt-4 w-full text-center text-sub select-none", {
          "opacity-25 blur-xs": isOutOfFocus(),
        })}
        style={{
          "font-size": getWordsFontSize(getConfig.fontSize),
          // instant unblur, 0.25s fade to blur — matches the imperative #words path
          transition: isOutOfFocus() ? "0.25s" : "none",
        }}
      >
        {getCompositionText()}
      </div>
    </Show>
  );
}
