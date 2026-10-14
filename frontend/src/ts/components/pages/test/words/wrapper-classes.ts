import { updateWordsMargin } from "./margins";
import { centerActiveLine } from "./line-jumping";
import {
  updateWordsInputPosition,
  updateWordsWrapperHeight,
  updateWordsWidth,
} from "./sizing";
import { updateHintsPositionDebounced } from "./hints";
import { setClass } from "./elements";
import { Config } from "../../../../config/store";
import { isInputElementFocused } from "../../../../input/input-element";
import { setResultState } from "../../../../states/result";
import {
  isLanguageRightToLeft,
  setTestFocusState,
} from "../../../../states/test";
import {
  getWordsElement as getWordsEl,
  getWordsWrapperElement as getWordsWrapperEl,
  getWordsInputElement,
  getCaretElement,
  getPaceCaretElement,
  getTypingTestElement,
} from "../../../../states/test-dom";
import * as Caret from "../../../../test/caret";
import { getWordsFontSize } from "../../../../utils/words-font";

export function updateWordWrapperClasses(): void {
  // outoffocus applies transition, need to remove it
  setTestFocusState("focused");

  if (Config.tapeMode !== "off") {
    setClass(getWordsEl(), "tape", true);
    setClass(getWordsWrapperEl(), "tape", true);
  } else {
    setClass(getWordsEl(), "tape", false);
    setClass(getWordsWrapperEl(), "tape", false);
  }

  if (Config.blindMode) {
    setClass(getWordsEl(), "blind", true);
    setClass(getWordsWrapperEl(), "blind", true);
  } else {
    setClass(getWordsEl(), "blind", false);
    setClass(getWordsWrapperEl(), "blind", false);
  }

  if (Config.indicateTypos === "below" || Config.indicateTypos === "both") {
    setClass(getWordsEl(), "indicateTyposBelow", true);
    setClass(getWordsWrapperEl(), "indicateTyposBelow", true);
  } else {
    setClass(getWordsEl(), "indicateTyposBelow", false);
    setClass(getWordsWrapperEl(), "indicateTyposBelow", false);
  }

  if (Config.hideExtraLetters) {
    setClass(getWordsEl(), "hideExtraLetters", true);
    setClass(getWordsWrapperEl(), "hideExtraLetters", true);
  } else {
    setClass(getWordsEl(), "hideExtraLetters", false);
    setClass(getWordsWrapperEl(), "hideExtraLetters", false);
  }

  if (Config.flipTestColors) {
    setClass(getWordsEl(), "flipped", true);
  } else {
    setClass(getWordsEl(), "flipped", false);
  }

  if (Config.colorfulMode) {
    setClass(getWordsEl(), "colorfulMode", true);
  } else {
    setClass(getWordsEl(), "colorfulMode", false);
  }

  for (const element of [
    getCaretElement(),
    getPaceCaretElement(),
    getTypingTestElement(),
  ]) {
    element.style.fontSize = getWordsFontSize(Config.fontSize);
  }
  // under 16px ios zooms the page in when the input is focused
  getWordsInputElement().style.fontSize = `max(16px, ${getWordsFontSize(Config.fontSize)})`;

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
  if (Config.highlightMode !== null) {
    existing.push(`highlight-${Config.highlightMode.replaceAll("_", "-")}`);
  }
  if (Config.typedEffect !== null) {
    existing.push(`typed-effect-${Config.typedEffect.replaceAll("_", "-")}`);
  }

  getWordsEl().className = existing.join(" ");

  updateWordsWidth();
  updateWordsWrapperHeight(true);
  if (!Config.showAllLines) {
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
