import { scrollToCenterOrTop } from "./dimensions";
import {
  blurInputElement,
  focusInputElement,
} from "../../../../input/input-element";
import { isTestActive } from "../../../../states/test";
import { getTypingTestElement } from "../../../../states/test-dom";
import { centerWordsInputEvent } from "../../../../states/words-layout";

export function focusWords(force = false): void {
  if (force) {
    blurInputElement();
  }
  focusInputElement(true);
  if (isTestActive()) {
    keepWordsInputInTheCenter(true);
  } else {
    const typingTest = getTypingTestElement();
    scrollToCenterOrTop(typingTest);
  }
}

export function keepWordsInputInTheCenter(force = false): void {
  centerWordsInputEvent.dispatch(force);
}
