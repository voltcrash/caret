import { onCleanup } from "solid-js";

import { createEffectOn } from "../../hooks/effects";
import { getActivePage } from "../../states/core";
import {
  handleModifierState,
  useCapsLockEvents,
  resetModifierState,
} from "../../states/modifiers";
import { updateAltGrState, resetAltGrState } from "../../test/layout-emulator";

export function ModifierEvents(): null {
  useCapsLockEvents();
  createEffectOn(getActivePage, (page) => {
    resetModifierState();
    resetAltGrState();
    if (page !== "test") return;
    const keydown = (event: KeyboardEvent): void => {
      updateAltGrState(event);
      handleModifierState(event, true);
    };
    const keyup = (event: KeyboardEvent): void => {
      updateAltGrState(event);
      handleModifierState(event, false);
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("keyup", keyup);
    onCleanup(() => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("keyup", keyup);
      resetModifierState();
      resetAltGrState();
    });
  });
  return null;
}
