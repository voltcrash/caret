import { createMemo, JSXElement, on } from "solid-js";

import { resultState } from "../../../../ts/states/result";
import {
  isResultCalculating,
  getResultVisible,
} from "../../../../ts/states/test";

export function ResultAnnouncement(): JSXElement {
  const summary = createMemo(
    on(
      () => getResultVisible() && !isResultCalculating(),
      (visible) => {
        const stats = resultState.stats;
        if (!visible || stats === undefined) return "";
        if (resultState.noStress) return "Test complete.";
        return `Test complete. ${stats.wpm.text} ${stats.typingSpeedUnit}. Accuracy ${stats.acc.text}. Time ${stats.time.text}.`;
      },
    ),
  );
  return (
    <div
      id="resultSummary"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    >
      {summary()}
    </div>
  );
}
