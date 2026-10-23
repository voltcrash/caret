import type { InsertionLayout } from "@oxytype/typing-engine/browser.client";
import { decodeText } from "@oxytype/typing-engine/text";
import { getEngineSession } from "../../../features/typing/runtime/session.client";
import * as TestUI from "../../../features/typing/runtime/test-ui";
import { getInputElementValue } from "../input-element";
import { isAwaitingNextWord } from "../state";
import * as SlowTimer from "../../states/slow-timer";
import {
  isTestRestarting,
  getActiveWordIndex,
  isResultCalculating,
} from "../../states/test";

/** Only DOM visibility/geometry is observed here; Rust decides its rule effects. */
export function observeInputView(now: number): void {
  const index = getActiveWordIndex();
  getEngineSession().command({
    op: "view",
    now,
    earliestVisibleWord:
      index > 0 && TestUI.getWordElement(index - 1) === null ? index : 0,
    deferAutomatic: null,
  });
}
export function insertionLayout(data: string): InsertionLayout {
  const layout: InsertionLayout = {
    slowTimer: SlowTimer.get(),
    wrapped: false,
    finalInBatch: null,
  };
  const preflight = getEngineSession().preflight(data, layout);
  if (preflight.measureOverflow) {
    const pending = TestUI.pendingWordData.get(getActiveWordIndex());
    const measured = TestUI.getActiveWordTopAndHeightWithDifferentData(
      (pending ?? getInputElementValue().inputValue) +
        decodeText(preflight.normalized),
    );
    layout.wrapped =
      measured.top > TestUI.activeWordTop ||
      measured.height > TestUI.activeWordHeight;
  }
  return layout;
}
export function onBeforeInsertText(data: string): boolean {
  const session = getEngineSession();
  if (
    !session.isPrepared() ||
    isTestRestarting() ||
    isAwaitingNextWord() ||
    isResultCalculating()
  ) {
    return true;
  }
  observeInputView(performance.now());
  return session.preflight(data, insertionLayout(data)).blocked;
}
