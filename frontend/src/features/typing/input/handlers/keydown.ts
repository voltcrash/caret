import { peekConfig } from "#shared/config/store.ts";
import * as TestLogic from "../../runtime/test/logic";
import { getCharFromEvent } from "../../runtime/layout-emulator";
import { emulateInsertText } from "./insert-text";
import {
  showNoticeNotification,
  showErrorNotification,
} from "#shared/states/notifications.ts";
import * as KeyConverter from "#shared/utils/key-converter.ts";
import * as ShiftTracker from "../../runtime/shift-tracker";
import { canQuickRestart } from "../../runtime/quick-restart";
import * as CustomText from "../../runtime/content/custom-text";
import {
  getLastBailoutAttempt,
  setCorrectShiftUsed,
  setLastBailoutAttempt,
} from "../state";
import { getActiveFunboxesWithFunction } from "../../runtime/funbox/list";
import { Keycode } from "#shared/constants/keys.ts";
import { wordsHaveTab } from "#shared/states/test.ts";
import { setBailedOut } from "#features/typing/state/run-flags.ts";
import { waitForKeymapLayout } from "#features/typing/state/keymap.ts";

import { getCustomTextIndicator } from "#shared/states/core.ts";
import { logTestEvent } from "../../runtime/events/data";
import { getTestEventCode } from "../../runtime/events/helpers";

async function handleTab(e: KeyboardEvent, now: number): Promise<void> {
  if (wordsHaveTab() && !e.shiftKey) {
    await emulateInsertText({ data: "\t", now });
    e.preventDefault();
    return;
  }
}

async function handleEnter(e: KeyboardEvent, _now: number): Promise<void> {
  if (e.shiftKey) {
    if (peekConfig().mode === "zen") {
      void TestLogic.finish();
      return;
    } else if (
      canQuickRestart(
        peekConfig().mode,
        peekConfig().words,
        peekConfig().time,
        CustomText.getData(),
        getCustomTextIndicator()?.isLong ?? false,
      ) === false
    ) {
      const delay = Date.now() - getLastBailoutAttempt();
      if (getLastBailoutAttempt() === -1 || delay > 200) {
        setLastBailoutAttempt(Date.now());
        if (delay >= 5000) {
          showNoticeNotification(
            "Please double tap shift+enter to confirm bail out",
            {
              important: true,
              durationMs: 5000,
            },
          );
        }
        e.preventDefault();
        return;
      } else {
        setBailedOut(true);
        void TestLogic.finish();
        return;
      }
    }
  }
}

async function handleOppositeShift(event: KeyboardEvent): Promise<void> {
  if (
    peekConfig().oppositeShiftMode === "keymap" &&
    peekConfig().keymapLayout !== "overrideSync"
  ) {
    let keymapLayout = await waitForKeymapLayout().catch(() => undefined);
    if (keymapLayout === undefined) {
      showErrorNotification("Failed to load keymap layout");

      return;
    }

    const keycode = KeyConverter.layoutKeyToKeycode(event.key, keymapLayout);
    setCorrectShiftUsed(
      keycode === undefined ? true : ShiftTracker.isUsingOppositeShift(keycode),
    );
  } else {
    setCorrectShiftUsed(
      ShiftTracker.isUsingOppositeShift(event.code as Keycode),
    );
  }
}

async function handleFunboxes(
  event: KeyboardEvent,
  now: number,
): Promise<boolean> {
  for (const fb of getActiveFunboxesWithFunction("handleKeydown")) {
    void fb.functions.handleKeydown(event);
  }

  for (const fb of getActiveFunboxesWithFunction("getEmulatedChar")) {
    const emulatedChar = fb.functions.getEmulatedChar(event);
    if (emulatedChar !== null) {
      await emulateInsertText({ data: emulatedChar, now });
      return true;
    }
  }
  return false;
}

export async function onKeydown(event: KeyboardEvent): Promise<void> {
  if (event.repeat) {
    // just ignore all repeats
    return;
  }

  const now = performance.now();

  logTestEvent("keydown", now, {
    code: getTestEventCode(event),
    ctrl: event.ctrlKey ? true : undefined,
    shift: event.shiftKey ? true : undefined,
    alt: event.altKey ? true : undefined,
    meta: event.metaKey ? true : undefined,
  });

  // allow arrows in arrows funbox
  const arrowsActive = peekConfig().funbox.includes("arrows");
  if (
    event.key === "Home" ||
    event.key === "End" ||
    event.key === "PageUp" ||
    event.key === "PageDown" ||
    (event.key.startsWith("Arrow") && !arrowsActive)
  ) {
    event.preventDefault();
    return;
  }

  if (peekConfig().oppositeShiftMode !== "off") {
    await handleOppositeShift(event);
  }

  const prevent = await handleFunboxes(event, now);
  if (prevent) {
    event.preventDefault();
    return;
  }

  if (peekConfig().layout !== "default") {
    const emulatedChar = await getCharFromEvent(event);
    if (emulatedChar !== null) {
      await emulateInsertText({ data: emulatedChar, now });
      event.preventDefault();
      return;
    }
  }

  if (event.key === "Tab") {
    await handleTab(event, now);
    return;
  }

  if (event.key === "Enter") {
    await handleEnter(event, now);
    return;
  }
}
