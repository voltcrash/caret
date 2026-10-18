import { Show } from "solid-js";

import { getConfig } from "../../../ts/config/store";
import { getCompositionText, testFocusState } from "../../../ts/states/test";
import { cn } from "../../../ts/utils/cn";
import { getWordsFontSize } from "../../../ts/utils/words-font";

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
