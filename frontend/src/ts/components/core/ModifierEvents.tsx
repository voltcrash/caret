import { onCleanup } from "solid-js";

import { createEffectOn } from "../../hooks/effects";
import { getActivePage } from "../../states/core";
import {
  handleModifierState,
  resetModifierState,
} from "../../states/modifiers";

export function ModifierEvents(): null {
  createEffectOn(getActivePage, (page) => {
    resetModifierState();
    if (page !== "test") return;
    const keydown = (event: KeyboardEvent): void =>
      handleModifierState(event, true);
    const keyup = (event: KeyboardEvent): void =>
      handleModifierState(event, false);
    document.addEventListener("keydown", keydown);
    document.addEventListener("keyup", keyup);
    onCleanup(() => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("keyup", keyup);
      resetModifierState();
    });
  });
  return null;
}
