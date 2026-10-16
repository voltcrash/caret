import { updateWordLetters } from "./rendering";
import { updateWordWrapperClasses } from "./wrapper-classes";
import { updateWordJoining } from "./joining";
import { updateHintsPositionDebounced } from "./hints";
import { configEvent } from "../../../../events/config";
import * as CompositionState from "../../../../states/composition";
import { getActivePage } from "../../../../states/core";
import {
  getActiveWordIndex,
  setCompositionText,
  setTestFocusState,
} from "../../../../states/test";
import {
  areTestElementsMounted,
  getWordsElement as getWordsEl,
} from "../../../../states/test-dom";
import { getCurrentInput } from "../../../../../features/typing/runtime/events/data";

export function onWordsConfigChange({
  key,
  newValue,
}: Parameters<Parameters<typeof configEvent.subscribe>[0]>[0]): void {
  if (!areTestElementsMounted()) return;
  if (key === "showOutOfFocusWarning" && !newValue) {
    setTestFocusState("focused");
  }
  if (key === "compositionDisplay" && newValue === "below") {
    setCompositionText(" ");
  }
  if (
    ["fontSize", "fontFamily", "blindMode", "hideExtraLetters"].includes(
      key ?? "",
    )
  ) {
    void updateHintsPositionDebounced();
  }
  if (key === "highlightMode") {
    if (getActivePage() === "test") {
      void updateWordLetters({
        input: getCurrentInput(),
        wordIndex: getActiveWordIndex(),
        compositionData: CompositionState.getData(),
      });
    }
  }
  if (
    [
      "highlightMode",
      "typedEffect",
      "blindMode",
      "indicateTypos",
      "tapeMode",
      "hideExtraLetters",
      "flipTestColors",
      "colorfulMode",
      "showAllLines",
      "fontSize",
      "fontFamily",
      "maxLineWidth",
      "tapeMargin",
    ].includes(key)
  ) {
    if (key !== "fontFamily") updateWordWrapperClasses();
    if (["typedEffect", "fontFamily", "fontSize"].includes(key)) {
      updateWordJoining(key, getWordsEl());
    }
  }
}
