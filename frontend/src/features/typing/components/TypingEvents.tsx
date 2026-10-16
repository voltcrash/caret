import { onCleanup, onMount } from "solid-js";
import { debounce, throttle } from "throttle-debounce";

import { getMutableConfig } from "../../../ts/config/store";
import { ModifierKeys } from "../../../ts/constants/modifier-keys";
import { updateCurrentCode } from "../../../ts/controllers/sound-controller";
import { isInputElementFocused } from "../../../ts/input/input-element";
import { getCustomTextIndicator } from "../../../ts/states/core";
import {
  handleModifierState,
  useCapsLockEvents,
} from "../../../ts/states/modifiers";
import { isAnyPopupVisible } from "../../../ts/states/overlay-visibility";
import {
  getFocus,
  getResultVisible,
  isTestActive,
} from "../../../ts/states/test";
import { isDevEnvironment } from "../../../ts/utils/env";
import { isCoarsePointer } from "../../../ts/utils/pointer";
import { canQuickRestart } from "../../../ts/utils/quick-restart";
import * as Caret from "../runtime/caret";
import * as CustomText from "../runtime/custom-text";
import * as Focus from "../runtime/focus";
import { updateAltGrState } from "../runtime/layout-emulator";
import * as TestUI from "../runtime/test-ui";
import { isTypingRouteActive, isTypingRouteTransitioning } from "../scope";

/**
 * Document/window listeners of the typing route. Owned by the test page and
 * removed with it; route exit resets modifier state. Rollback keeps the page
 * mounted, so every handler also checks route activity.
 */
export function TypingEvents(): null {
  useCapsLockEvents();
  onMount(() => {
    const autofocus = (e: KeyboardEvent): void => {
      updateCurrentCode(e);
      if (isTypingRouteTransitioning() || e.key === undefined) return;
      if (
        isDevEnvironment() &&
        (document.activeElement as HTMLElement | null)?.dataset["uiElement"] ===
          "signalDevtoolsInput"
      ) {
        return;
      }
      if (
        isTypingRouteActive() &&
        !getResultVisible() &&
        !isInputElementFocused()
      ) {
        // Keep the expensive popup check outside the focused keystroke path.
        if (
          !isAnyPopupVisible() &&
          !["Enter", " ", "Escape", "Tab", ...ModifierKeys].includes(e.key) &&
          !e.metaKey &&
          !e.ctrlKey
        ) {
          TestUI.focusWords();
          if (getMutableConfig().showOutOfFocusWarning) e.preventDefault();
        }
      }
    };
    const modifierDown = (event: KeyboardEvent): void => {
      if (!isTypingRouteActive()) return;
      updateAltGrState(event);
      handleModifierState(event, true);
    };
    const modifierUp = (event: KeyboardEvent): void => {
      if (!isTypingRouteActive()) return;
      updateAltGrState(event);
      handleModifierState(event, false);
    };
    const mousemove = (event: MouseEvent): void => {
      if (isTypingRouteTransitioning() || !getFocus()) return;
      // Ignore small desk/mouse vibrations, preserving the >3px guard.
      if (event.movementX > 3 || event.movementY > 3) Focus.set(false);
    };
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      if (
        isTypingRouteActive() &&
        isTestActive() &&
        !canQuickRestart(
          getMutableConfig().mode,
          getMutableConfig().words,
          getMutableConfig().time,
          CustomText.getData(),
          getCustomTextIndicator()?.isLong ?? false,
        )
      ) {
        event.preventDefault();
        // Included for legacy support, e.g. Chrome/Edge < 119.
        // oxlint-disable-next-line no-deprecated -- beforeunload returnValue preserves confirmation in legacy browsers.
        event.returnValue = "";
      }
    };

    const timers = new Set<ReturnType<typeof setTimeout>>();
    const debouncedResize = debounce(250, () => {
      if (!isTypingRouteActive() || getResultVisible()) return;
      if (getMutableConfig().tapeMode !== "off") {
        void TestUI.scrollTape();
      } else {
        void TestUI.centerActiveLine();
        void TestUI.updateHintsPositionDebounced();
      }
      const timer = setTimeout(() => {
        timers.delete(timer);
        TestUI.updateWordsInputPosition();
        // on touch, mobile URL bar/keyboard resizes must not reopen the keyboard
        // the user dismissed, so only refocus if the input already has focus
        if (!isCoarsePointer() || isInputElementFocused()) {
          TestUI.focusWords();
        }
        Caret.show();
      }, 250);
      timers.add(timer);
    });
    const throttledResize = throttle(250, () => Caret.hide());
    const resize = (): void => {
      throttledResize();
      debouncedResize();
    };

    document.addEventListener("keydown", autofocus);
    document.addEventListener("keydown", modifierDown);
    document.addEventListener("keyup", modifierUp);
    document.addEventListener("mousemove", mousemove);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("resize", resize);
    onCleanup(() => {
      document.removeEventListener("keydown", autofocus);
      document.removeEventListener("keydown", modifierDown);
      document.removeEventListener("keyup", modifierUp);
      document.removeEventListener("mousemove", mousemove);
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("resize", resize);
      debouncedResize.cancel();
      throttledResize.cancel();
      for (const timer of timers) clearTimeout(timer);
    });
  });
  return null;
}
