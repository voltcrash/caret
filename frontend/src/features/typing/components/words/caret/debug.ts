import { createAppOwned } from "#app/application.ts";
import { appObject } from "#app/state.ts";
import { getWordsElement as getWordsCache } from "#features/typing/state/test-dom.ts";

import { setCaretClass } from "./dom";

const debug = appObject(createAppOwned(() => ({ enabled: false })));

export function isCaretDebugEnabled(): boolean {
  return debug.enabled;
}

export function toggleCaretDebug(): void {
  debug.enabled = !debug.enabled;
  if (!debug.enabled) {
    for (const l of getWordsCache().querySelectorAll<HTMLElement>(
      ".word letter",
    )) {
      setCaretClass(l, "debugCaret", false);
      setCaretClass(l, "debugCaretTarget", false);
      setCaretClass(l, "debugCaretTarget2", false);
    }
  } else {
    for (const l of getWordsCache().querySelectorAll<HTMLElement>(
      ".word letter",
    )) {
      setCaretClass(l, "debugCaret", true);
    }
  }
}
