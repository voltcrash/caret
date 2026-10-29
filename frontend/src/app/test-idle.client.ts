import { createEffect, createRoot, onCleanup } from "solid-js";

import { requireApplication } from "./application";
import { isTestActive, isTestRestarting, isResultCalculating } from "../ts/states/test";

/** Late account preferences must not change an in-progress typing session. */
export async function waitForTestIdle(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  const owner = requireApplication().owner;
  return new Promise((resolve, reject) => {
    createRoot((dispose) => {
      const abort = (): void => {
        dispose();
        reject(signal.reason);
      };
      signal.addEventListener("abort", abort, { once: true });
      onCleanup(() => signal.removeEventListener("abort", abort));
      createEffect(() => {
        if (isTestActive() || isTestRestarting() || isResultCalculating()) return;
        dispose();
        resolve();
      });
    }, owner);
  });
}
