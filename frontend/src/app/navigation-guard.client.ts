import { createEffect, createRoot } from "solid-js";

import type { NavigateOptions } from "./navigate";
import { showNoticeNotification } from "../ts/states/notifications";
import {
  isTestActive,
  isTestRestarting,
  isResultCalculating,
} from "../ts/states/test";
import { isNoQuitActive } from "../features/typing/runtime/session.client";

function inTransition(): boolean {
  return isTestRestarting() || isResultCalculating();
}

/**
 * Resolves once a test restart or result calculation finishes (or after
 * `timeoutMs`), so navigation requested during one runs after it instead of
 * being dropped. A signed-in startup restarts the test when server settings
 * arrive, right as the page becomes clickable.
 */
export async function transitionSettled(timeoutMs = 3000): Promise<void> {
  if (!inTransition()) return;
  await new Promise<void>((resolve) => {
    createRoot((dispose) => {
      const timer = setTimeout(done, timeoutMs);
      function done(): void {
        clearTimeout(timer);
        dispose();
        resolve();
      }
      createEffect(() => {
        if (!inTransition()) done();
      });
    });
  });
}

/** Router-independent test guard; hosts add their own transition state. */
export function canNavigate(options: NavigateOptions = {}): boolean {
  if (!options.force && (isTestRestarting() || isResultCalculating())) {
    return false;
  }

  if (isTestActive() && isNoQuitActive()) {
    showNoticeNotification(
      "No quit funbox is active. Please finish the test.",
      { important: true },
    );
    return false;
  }

  return true;
}
