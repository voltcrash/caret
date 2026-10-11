import { Show } from "solid-js";

import {
  outOfFocusMaxHeight,
  showOutOfFocusWarning,
  testFocusState,
} from "../../../states/test";
import { isCoarsePointer } from "../../../utils/pointer";
import { Fa } from "../../common/Fa";

export function OutOfFocusWarning() {
  const message = () => {
    const isCoarse = isCoarsePointer();
    if (testFocusState() === "unfocusedWindow") {
      return isCoarse
        ? "Tap anywhere to focus the window"
        : "Click anywhere to focus the window";
    }
    return isCoarse
      ? "Tap here to start typing"
      : "Click here or press any key to focus";
  };

  return (
    <Show when={showOutOfFocusWarning()}>
      <div
        class="pointer-events-none absolute z-999 flex h-full w-full place-content-center items-center gap-2 px-4 text-center text-base select-none"
        style={{
          "max-height":
            outOfFocusMaxHeight() !== undefined
              ? `${outOfFocusMaxHeight()}px`
              : undefined,
        }}
      >
        <div>
          <Fa icon="fa-mouse-pointer" fixedWidth />
        </div>
        <div>{message()}</div>
      </div>
    </Show>
  );
}
