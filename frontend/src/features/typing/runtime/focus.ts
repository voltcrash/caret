import { batch } from "solid-js";

import * as Caret from "./caret";
import { setFocusCursorHidden } from "#shared/states/app.ts";
import { requestDebouncedAnimationFrame } from "#shared/utils/debounced-animation-frame.ts";
import { getFocus, setFocus } from "#shared/states/test.ts";

// withCursor is used on initial load to keep the pointer visible.
export function set(value: boolean, withCursor = false): void {
  if (value === getFocus()) return;
  requestDebouncedAnimationFrame("focus.set", () => {
    if (value === getFocus()) return;
    batch(() => {
      setFocus(value);
      setFocusCursorHidden(value && !withCursor);
    });
    if (value) {
      Caret.stopAnimation();
    } else {
      Caret.startAnimation();
    }
  });
}
