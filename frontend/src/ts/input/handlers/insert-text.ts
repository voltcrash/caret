import { decodeText, encodeText } from "@oxytype/typing-engine/text";
import { getBrowserEngine } from "../../../features/typing/engine.client";
import { getEngineSession } from "../../../features/typing/runtime/session.client";
import { getContentHost } from "../../../features/typing/runtime/content.client";
import { getMutableConfig } from "../../config/store";
import { isTestRestarting, isResultCalculating } from "../../states/test";
import { isCorrectShiftUsed } from "../state";
import {
  getInputElementValue,
  setInputElementValue,
  appendToInputElementValue,
} from "../input-element";
import {
  insertionLayout,
  observeInputView,
  onBeforeInsertText,
} from "./before-insert-text";

type OnInsertTextParams = {
  now: number;
  data: string;
  isCompositionEnding?: true;
  lastInMultiIndex?: boolean;
  automatic?: true;
};
export async function onInsertText(options: OnInsertTextParams): Promise<void> {
  const session = getEngineSession();
  if (!session.isPrepared() || isTestRestarting() || isResultCalculating()) {
    return;
  }
  const lease = getBrowserEngine().captureSession();
  // Browsers have already inserted this batch. Restore the baseline so layout
  // measurements see the same per-unit DOM as physical typing/IME previously did.
  setInputElementValue(
    getInputElementValue().inputValue.slice(0, -options.data.length),
  );
  for (let index = 0; index < options.data.length; index++) {
    if (!lease.isCurrent()) {
      return;
    }
    const raw = options.data.charAt(index); // Explicit JavaScript UTF-16 units.
    const preflight = session.preflight(raw);
    const prepared =
      preflight.expanded === undefined ? raw : decodeText(preflight.expanded);
    for (let part = 0; part < prepared.length; part++) {
      if (!lease.isCurrent()) {
        return;
      }
      const data = prepared.charAt(part);
      observeInputView(options.now);
      const update = session.command({
        op: "insert",
        now: options.now,
        date: Date.now(),
        data: encodeText(data),
        correctShiftUsed:
          getMutableConfig().oppositeShiftMode === "off"
            ? null
            : isCorrectShiftUsed(),
        automatic: options.automatic ?? null,
        isCompositionEnding: options.isCompositionEnding ?? null,
        layout: {
          ...insertionLayout(data),
          finalInBatch:
            index === options.data.length - 1 &&
            part === prepared.length - 1 &&
            options.lastInMultiIndex !== false,
        },
      });
      if (update.awaitingContent && update.contentRequest !== undefined) {
        await getContentHost().supplyActive(update.contentRequest);
      }
    }
  }
}
export async function emulateInsertText(
  options: OnInsertTextParams,
): Promise<void> {
  if (onBeforeInsertText(options.data)) {
    return;
  }
  appendToInputElementValue(options.data);
  await onInsertText(options);
}
