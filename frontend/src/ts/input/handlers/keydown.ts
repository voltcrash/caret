import { getMutableConfig } from "../../config/store";
import * as TestLogic from "../../test/test-logic";
import { getCharFromEvent } from "../../test/layout-emulator";
import { emulateInsertText } from "./insert-text";
import {
  showNoticeNotification,
  showErrorNotification,
} from "../../states/notifications";
import * as KeyConverter from "../../utils/key-converter";
import * as ShiftTracker from "../../test/shift-tracker";
import { canQuickRestart } from "../../utils/quick-restart";
import * as CustomText from "../../test/custom-text";
import {
  getLastBailoutAttempt,
  setCorrectShiftUsed,
  setLastBailoutAttempt,
} from "../state";
import { getActiveFunboxesWithFunction } from "../../test/funbox/list";
import { Keycode } from "../../constants/keys";
import {
  setBailedOut,
  waitForKeymapLayout,
  wordsHaveTab,
} from "../../states/test";

import { getCustomTextIndicator } from "../../states/core";
import { logTestEvent } from "../../test/events/data";
import { getTestEventCode } from "../../test/events/helpers";

async function handleTab(e: KeyboardEvent, now: number): Promise<void> {
  if (wordsHaveTab() && !e.shiftKey) {
    await emulateInsertText({ data: "\t", now });
    e.preventDefault();
    return;
  }
}

async function handleEnter(e: KeyboardEvent, _now: number): Promise<void> {
  if (e.shiftKey) {
    if (getMutableConfig().mode === "zen") {
      void TestLogic.finish();
      return;
    } else if (
      !canQuickRestart(
        getMutableConfig().mode,
        getMutableConfig().words,
        getMutableConfig().time,
        CustomText.getData(),
        getCustomTextIndicator()?.isLong ?? false,
      )
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
    getMutableConfig().oppositeShiftMode === "keymap" &&
    getMutableConfig().keymapLayout !== "overrideSync"
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
  const arrowsActive = getMutableConfig().funbox.includes("arrows");
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

  if (getMutableConfig().oppositeShiftMode !== "off") {
    await handleOppositeShift(event);
  }

  const prevent = await handleFunboxes(event, now);
  if (prevent) {
    event.preventDefault();
    return;
  }

  if (getMutableConfig().layout !== "default") {
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
