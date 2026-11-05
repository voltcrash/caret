import { setIsScreenshotting } from "../../ts/states/core";
import { setScreenshotWatermark } from "../../ts/states/result";
import { preferencesReadiness } from "../../app/readiness";
import { setTypingReady } from "../../app/startup";
import { setFocusCursorHidden } from "../../ts/states/app";
import { hideLoaderBar } from "../../ts/states/loader-bar";
import { resetModifierState } from "../../ts/states/modifiers";
import {
  resetIncompleteTests,
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
import { getBrowserEngine } from "./engine.client";
import * as Funbox from "./runtime/funbox/funbox";
import { getActiveFunboxesWithFunction } from "./runtime/funbox/list";
import * as Layoutfluid from "./runtime/funbox/layoutfluid-funbox-timer";
import * as PaceCaret from "./runtime/pace-caret";
import * as Replay from "./runtime/replay";
import * as Timer from "./runtime/test-timer";
import { restart } from "./runtime/test-logic";
import { resetAltGrState } from "./runtime/layout-emulator";
import { getTypingLifecycle } from "./lifecycle-controller";

/** Returning always starts a new test; never resumes detached engine/DOM state. */
export async function enterTypingRoute(): Promise<void> {
  const mount = captureTypingMount();
  const lifecycle = getTypingLifecycle();
  const operation = lifecycle.capture();
  try {
    await operation.wait(preferencesReadiness().wait());
    if (!mount.activate()) return;
    resetIncompleteTests();
    await restart({ noAnim: true });
  } catch (error) {
    if (!mount.isCurrent()) return;
    if (mount.isCurrent()) {
      lifecycle.send({ type: "FAIL", error });
    }
    throw error;
  } finally {
    // A failed initialization must reveal its error; stale mounts cannot
    // release the startup cover over a replacement typing route.
    if (mount.isCurrent()) setTypingReady(true);
  }
}

/** Synchronous teardown: no generation, animation or async work against detached refs. */
export function exitTypingRoute(): void {
  getTypingLifecycle().send({ type: "UNMOUNT" });
  setTypingReady(false);
  Timer.clear();
  PaceCaret.reset();
  Replay.pauseReplay();
  getTestSession().reset();
  getBrowserEngine().releaseSession();
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
  setIsScreenshotting(false);
  setScreenshotWatermark(undefined);
  setFocus(false);
  setFocusCursorHidden(false);
  setTestFocusState("focused");
  hideLoaderBar();
  cancelPendingAnimationFrame("focus.set");
  cancelPendingAnimationFramesStartingWith("test-ui");
}
