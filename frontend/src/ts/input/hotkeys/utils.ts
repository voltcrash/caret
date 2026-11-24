import {
  CreateHotkeyOptions,
  HotkeyChord,
  HotkeyCallback,
  HotkeyCallbackContext,
  createHotkey as registerHotkey,
} from "@tanstack/solid-hotkeys";
import { isAnyPopupVisible } from "../../states/overlay-visibility";
import { isTypingInputFocused } from "../../typing-host";
import * as CompositionState from "../../states/composition";

export const NoKey = "" as HotkeyChord;

export function createHotkey(
  hotkey: HotkeyChord | (() => HotkeyChord),
  callback: HotkeyCallback,
  options: () => Partial<
    Omit<
      CreateHotkeyOptions,
      "ignoreInputs" | "stopPropagation" | "preventDefault"
    >
  > = () => ({}),
): void {
  registerHotkey(
    hotkey,
    (e, context) => {
      if (handleHotkeyOnInteractiveElement(e, context)) return;
      e.stopPropagation();
      e.preventDefault();
      callback(e, context);
    },
    () => {
      const resolvedOptions = {
        ignoreInputs: false, //hotkeys are active on the words input, but not on other interactive elements
        stopPropagation: false, //we set stopPropagation in the callback if the hotkey executes
        preventDefault: false, //we set preventDefault in the callback if the hotkey executes
        requireReset: true,
        conflictBehavior: "replace" as const,
        enabled: (typeof hotkey === "function" ? hotkey() : hotkey) !== NoKey,
        ...options(),
      };
      // Disabled registrations still replace active shortcuts with the same key.
      return resolvedOptions.enabled
        ? resolvedOptions
        : { ...resolvedOptions, target: null };
    },
  );
}

function isInteractiveElementFocused(): boolean {
  if (isTypingInputFocused()) return false;

  return (
    document.activeElement?.tagName === "A" ||
    document.activeElement?.tagName === "INPUT" ||
    document.activeElement?.tagName === "TEXTAREA" ||
    document.activeElement?.tagName === "SELECT" ||
    document.activeElement?.tagName === "BUTTON" ||
    document.activeElement?.tagName === "SUMMARY" ||
    document.activeElement?.matches(
      ".button, .textButton, .modal, [data-balloon-pos]",
    ) === true
  );
}

function handleHotkeyOnInteractiveElement(
  e: KeyboardEvent,
  { hotkey }: HotkeyCallbackContext,
): boolean {
  if (
    (hotkey === "Tab" || hotkey === "Shift+Tab" || hotkey === "Enter") &&
    isInteractiveElementFocused()
  ) {
    return true;
  } else if (hotkey === "Escape" && isAnyPopupVisible()) {
    return true;
  } else if (
    hotkey === "Escape" &&
    isTypingInputFocused() &&
    CompositionState.getData() !== ""
  ) {
    return true;
  }

  return false;
}
