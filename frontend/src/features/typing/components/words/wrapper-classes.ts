import { updateWordsMargin } from "./margins";
import { centerActiveLine } from "./line-jumping";
import {
  updateWordsInputPosition,
  updateWordsWrapperHeight,
  updateWordsWidth,
} from "./sizing";
import { updateHintsPositionDebounced } from "./hints";
import { setClass } from "./elements";
import { peekConfig } from "#shared/config/store.ts";
import { isInputElementFocused } from "#features/typing/input/input-element.ts";
import { setResultState } from "../../state/result";
import { setTestFocusState } from "#shared/states/test.ts";
import { isLanguageRightToLeft } from "#features/typing/state/direction.ts";
import {
  getWordsElement as getWordsEl,
  getWordsWrapperElement as getWordsWrapperEl,
  getWordsInputElement,
  getCaretElement,
  getPaceCaretElement,
  getTypingTestElement,
} from "#shared/states/test-dom.ts";
import * as Caret from "../../runtime/caret";
import { getWordsFontSize } from "./font";

export function updateWordWrapperClasses(): void {
  // outoffocus applies transition, need to remove it
  setTestFocusState("focused");

  if (peekConfig().tapeMode !== "off") {
    setClass(getWordsEl(), "tape", true);
    setClass(getWordsWrapperEl(), "tape", true);
  } else {
    setClass(getWordsEl(), "tape", false);
    setClass(getWordsWrapperEl(), "tape", false);
  }

  if (peekConfig().blindMode) {
    setClass(getWordsEl(), "blind", true);
    setClass(getWordsWrapperEl(), "blind", true);
  } else {
    setClass(getWordsEl(), "blind", false);
    setClass(getWordsWrapperEl(), "blind", false);
  }

  if (
    peekConfig().indicateTypos === "below" ||
    peekConfig().indicateTypos === "both"
  ) {
    setClass(getWordsEl(), "indicateTyposBelow", true);
    setClass(getWordsWrapperEl(), "indicateTyposBelow", true);
  } else {
    setClass(getWordsEl(), "indicateTyposBelow", false);
    setClass(getWordsWrapperEl(), "indicateTyposBelow", false);
  }

  if (peekConfig().hideExtraLetters) {
    setClass(getWordsEl(), "hideExtraLetters", true);
    setClass(getWordsWrapperEl(), "hideExtraLetters", true);
  } else {
    setClass(getWordsEl(), "hideExtraLetters", false);
    setClass(getWordsWrapperEl(), "hideExtraLetters", false);
  }

  if (peekConfig().flipTestColors) {
    setClass(getWordsEl(), "flipped", true);
  } else {
    setClass(getWordsEl(), "flipped", false);
  }

  if (peekConfig().colorfulMode) {
    setClass(getWordsEl(), "colorfulMode", true);
  } else {
    setClass(getWordsEl(), "colorfulMode", false);
  }

  for (const element of [
    getCaretElement(),
    getPaceCaretElement(),
    getTypingTestElement(),
  ]) {
    element.style.fontSize = getWordsFontSize(peekConfig().fontSize);
  }
  // under 16px ios zooms the page in when the input is focused
  getWordsInputElement().style.fontSize = `max(16px, ${getWordsFontSize(peekConfig().fontSize)})`;

  if (isLanguageRightToLeft()) {
    setClass(getWordsEl(), "rightToLeftTest", true);
  } else {
    setClass(getWordsEl(), "rightToLeftTest", false);
  }
  setResultState("rightToLeft", isLanguageRightToLeft());

  const existing =
    getWordsEl()
      .className.split(/\s+/)
      .filter(
        (className) =>
          !className.startsWith("highlight-") &&
          !className.startsWith("typed-effect-"),
      ) ?? [];
  if (peekConfig().highlightMode !== null) {
    existing.push(
      `highlight-${peekConfig().highlightMode.replaceAll("_", "-")}`,
    );
  }
  if (peekConfig().typedEffect !== null) {
    existing.push(
      `typed-effect-${peekConfig().typedEffect.replaceAll("_", "-")}`,
    );
  }

  getWordsEl().className = existing.join(" ");

  updateWordsWidth();
  updateWordsWrapperHeight(true);
  if (!peekConfig().showAllLines) {
    void centerActiveLine();
  }
  updateWordsMargin();
  updateWordsInputPosition();
  void updateHintsPositionDebounced();
  Caret.updatePosition(true);

  if (!isInputElementFocused()) {
    setTestFocusState("unfocused");
  }
}
