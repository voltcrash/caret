import { onCleanup, onMount } from "solid-js";

import { getMutableConfig } from "../../../ts/config/store";
import { isInputElementFocused } from "../../../ts/input/input-element";
import { bindInputListenersTo } from "../../../ts/input/listeners";
import {
  getResultVisible,
  isTestActive,
  setTestFocusState,
} from "../../../ts/states/test";
import * as Caret from "../runtime/caret";
import { restart } from "../runtime/test-logic";

export function TestPageLifecycle(props: { input: HTMLTextAreaElement }): null {
  onMount(() => {
    const focus = (): void => {
      if (!isInputElementFocused()) return;
      if (!getResultVisible() && getMutableConfig().showOutOfFocusWarning) {
        setTestFocusState("focused");
      }
      Caret.show(true);
    };
    const focusout = (): void => {
      if (!isInputElementFocused()) setTestFocusState("unfocused");
      Caret.hide();
    };
    const windowBlur = (): void => setTestFocusState("unfocusedWindow");
    const windowFocus = (): void => {
      if (
        !isTestActive() &&
        !getResultVisible() &&
        (getMutableConfig().mode === "time" ||
          getMutableConfig().mode === "words")
      ) {
        void restart({ noAnim: true });
      }
    };
    const visibilityChange = (): void => {
      if (document.visibilityState === "hidden") windowBlur();
      if (document.visibilityState === "visible") windowFocus();
    };
    const input = props.input;
    bindInputListenersTo(input);
    input.addEventListener("focus", focus);
    input.addEventListener("focusout", focusout);
    window.addEventListener("blur", windowBlur);
    window.addEventListener("focus", windowFocus);
    document.addEventListener("visibilitychange", visibilityChange);
    onCleanup(() => {
      input.removeEventListener("focus", focus);
      input.removeEventListener("focusout", focusout);
      window.removeEventListener("blur", windowBlur);
      window.removeEventListener("focus", windowFocus);
      document.removeEventListener("visibilitychange", visibilityChange);
    });
  });
  return null;
}
