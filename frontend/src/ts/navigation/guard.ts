import type { NavigateOptions } from "./navigation";
import { showNoticeNotification } from "../states/notifications";
import {
  isTestActive,
  isTestRestarting,
  isResultCalculating,
} from "../states/test";
import { isFunboxActive } from "../test/funbox/list";

/** Router-independent test guard; hosts add their own transition state. */
export function canNavigate(options: NavigateOptions = {}): boolean {
  if (!options.force && (isTestRestarting() || isResultCalculating())) {
    return false;
  }

  if (isTestActive() && isFunboxActive("no_quit")) {
    showNoticeNotification(
      "No quit funbox is active. Please finish the test.",
      { important: true },
    );
    return false;
  }

  return true;
}
