import { setIsScreenshotting } from "../../ts/states/core";
import { setScreenshotWatermark } from "../../ts/states/result";
import { preferencesReadiness } from "../../app/readiness";
import { setFocusCursorHidden } from "../../ts/states/app";
import { hideLoaderBar } from "../../ts/states/loader-bar";
import { resetModifierState } from "../../ts/states/modifiers";
import {
  resetIncompleteTests,
  setTestActive,
  setIsTestRestarting,
  setResultCalculating,
  setResultLoading,
  setResultVisible,
  setFocus,
  setCompositionText,
  setTestFocusState,
} from "../../ts/states/test";
import * as Composition from "../../ts/states/composition";
import {
  cancelPendingAnimationFrame,
  cancelPendingAnimationFramesStartingWith,
} from "../../ts/utils/debounced-animation-frame";
import { captureTypingMount } from "./scope";
import { getTestSession } from "./runtime/events/data";
import * as Funbox from "./runtime/funbox/funbox";
import { getActiveFunboxesWithFunction } from "./runtime/funbox/list";
import * as Layoutfluid from "./runtime/funbox/layoutfluid-funbox-timer";
import * as PaceCaret from "./runtime/pace-caret";
import * as Replay from "./runtime/replay";
import * as Timer from "./runtime/test-timer";
import { restart } from "./runtime/test-logic";
import { resetAltGrState } from "./runtime/layout-emulator";

/** Returning always starts a new test; never resumes detached engine/DOM state. */
export async function enterTypingRoute(): Promise<void> {
  const mount = captureTypingMount();
  await preferencesReadiness().wait();
  if (!mount.activate()) return;
  resetIncompleteTests();
  await restart({ noAnim: true });
}

/** Synchronous teardown: no generation, animation or async work against detached refs. */
export function exitTypingRoute(): void {
  Timer.clear();
  PaceCaret.reset();
  Replay.pauseReplay();
  getTestSession().reset();
  for (const funbox of getActiveFunboxesWithFunction("clearGlobal")) {
    funbox.functions.clearGlobal();
  }
  void Funbox.clear();
  Layoutfluid.instantHide();
  window.speechSynthesis?.cancel();
  resetModifierState();
  resetAltGrState();
  Composition.setComposing(false);
  Composition.setData("");
  setCompositionText("");
  setTestActive(false);
  setIsTestRestarting(false);
  setResultCalculating(false);
  setResultLoading(false);
  setResultVisible(false);
  setIsScreenshotting(false);
  setScreenshotWatermark(undefined);
  setFocus(false);
  setFocusCursorHidden(false);
  setTestFocusState("focused");
  hideLoaderBar();
  cancelPendingAnimationFrame("focus.set");
  cancelPendingAnimationFramesStartingWith("test-ui");
}
