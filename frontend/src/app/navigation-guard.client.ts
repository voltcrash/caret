import type { NavigateOptions } from "./navigate";
import { showNoticeNotification } from "../ts/states/notifications";
import {
  isTestActive,
  isTestRestarting,
  isResultCalculating,
} from "../ts/states/test";
import { isNoQuitActive } from "../features/typing/runtime/session.client";

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
