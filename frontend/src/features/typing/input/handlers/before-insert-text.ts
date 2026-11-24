import type { InsertionLayout } from "@caret/typing-engine/browser.client";
import { decodeText } from "@caret/typing-engine/text";
import { getEngineSession } from "../../runtime/session.client";
import * as TestUI from "../../runtime/test/ui";
import { getInputElementValue } from "#features/typing/input/input-element.ts";
import { isAwaitingNextWord } from "../state";
import * as SlowTimer from "../../state/slow-timer";
import { isTestRestarting, isResultCalculating } from "#shared/states/test.ts";
import { getActiveWordIndex } from "#features/typing/state/active-word.ts";

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
type Preflight = ReturnType<ReturnType<typeof getEngineSession>["preflight"]>;

function baseLayout(): InsertionLayout {
  return { slowTimer: SlowTimer.get(), wrapped: false, finalInBatch: null };
}

/** Measures DOM wrap only when Rust's preflight asks for it. */
function measureWrap(
  layout: InsertionLayout,
  preflight: Preflight,
): InsertionLayout {
  if (preflight.measureOverflow) {
    const pending = TestUI.getPendingWordData(getActiveWordIndex());
    const measured = TestUI.getActiveWordTopAndHeightWithDifferentData(
      (pending ?? getInputElementValue().inputValue) +
        decodeText(preflight.normalized),
    );
    layout.wrapped =
      measured.top > TestUI.lineState.activeWordTop ||
      measured.height > TestUI.lineState.activeWordHeight;
  }
  return layout;
}
export function insertionLayout(data: string): InsertionLayout {
  const layout = baseLayout();
  return measureWrap(layout, getEngineSession().preflight(data, layout));
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
  const layout = baseLayout();
  const preflight = session.preflight(data, layout);
  // Preflight is pure; without a measurement the layout is unchanged.
  if (!preflight.measureOverflow) return preflight.blocked;
  return session.preflight(data, measureWrap(layout, preflight)).blocked;
}
