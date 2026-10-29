import { createMemo, type Accessor } from "solid-js";
import { isServer } from "solid-js/web";

import { createAppSignal } from "./state";

// Chrome readiness covers browser chrome and stored preferences.
// Startup finishes when the first route can accept input; background work follows.
export const [isChromeReady, setChromeReady] = createAppSignal(false);
// The current typing mount has initialized its first test or exposed an error.
export const [isTypingReady, setTypingReady] = createAppSignal(false);
export const [isStartupFinished, setStartupFinished] = createAppSignal(false);

/** Finish once per layout; later navigation and restarts do not suspend integrations. */
export function createStartupReveal(
  typing: Accessor<boolean>,
): Accessor<boolean> {
  return createMemo(
    (revealed) =>
      revealed ||
      (!isServer &&
        (isStartupFinished() ||
          (isChromeReady() && (!typing() || isTypingReady())))),
    false,
  );
}
