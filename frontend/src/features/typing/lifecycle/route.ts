import { setIsScreenshotting } from "#shared/states/core.ts";
import { setScreenshotWatermark } from "../state/result";
import { preferencesReadiness } from "#app/readiness.ts";
import { setTypingReady } from "#app/startup.ts";
import { setFocusCursorHidden } from "#shared/states/app.ts";
import { hideLoaderBar } from "#shared/states/loader-bar.ts";
import { resetModifierState } from "../state/modifiers";
import {
  resetIncompleteTests,
  setFocus,
  setTestFocusState,
} from "#shared/states/test.ts";
import { setCompositionText } from "#features/typing/state/composition.ts";
import * as Composition from "#shared/states/composition.ts";
import {
  cancelPendingAnimationFrame,
  cancelPendingAnimationFramesStartingWith,
} from "#shared/utils/debounced-animation-frame.ts";
import { captureTypingMount } from "../scope";
import { getTestSession } from "../runtime/events/data";
import { getBrowserEngine } from "#shared/engine/owner.client.ts";
import * as Funbox from "../runtime/funbox/funbox";
import { getActiveFunboxesWithFunction } from "../runtime/funbox/list";
import * as Layoutfluid from "../runtime/funbox/layoutfluid-funbox-timer";
import * as PaceCaret from "../runtime/pace-caret";
import * as Replay from "../runtime/replay";
import * as Timer from "../runtime/test/timer";
import { restart } from "../runtime/test/logic";
import { resetAltGrState } from "../runtime/layout-emulator";
import { getTypingLifecycle } from "#shared/states/test-lifecycle/controller.ts";

/** Returning always starts a new test; never resumes detached engine/DOM state. */
export async function enterTypingRoute(): Promise<void> {
  const mount = captureTypingMount();
  const lifecycle = getTypingLifecycle();
  const operation = lifecycle.capture();
  try {
    // Preferences can await a slow engine download; Restart needs activation first.
    await operation.wait(preferencesReadiness().wait(), null);
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
  const engine = getBrowserEngine();
  const failed = engine.status().state === "failed";
  if (!failed) PaceCaret.reset();
  Replay.pauseReplay();
  if (!failed) getTestSession().reset();
  engine.releaseSession(!failed);
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
