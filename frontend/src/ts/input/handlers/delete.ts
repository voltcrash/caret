import { encodeText } from "@caret/typing-engine/text";
import { getEngineSession } from "../../../features/typing/runtime/session.client";
import { getInputElementValue } from "../input-element";
import type { DeleteInputType } from "../helpers/input-type";
import { observeInputView } from "./before-insert-text";

export function onDelete(inputType: DeleteInputType, now: number): void {
  const session = getEngineSession();
  if (!session.isPrepared()) {
    return;
  }
  const { inputValue, realInputValue } = getInputElementValue();
  observeInputView(now);
  session.command({
    op: "delete",
    now,
    date: Date.now(),
    kind: inputType,
    observedInput: encodeText(inputValue),
    sentinelRemoved: realInputValue === "",
  });
}
