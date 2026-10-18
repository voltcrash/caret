import { scrollToCenterOrTop } from "./dimensions";
import {
  blurInputElement,
  focusInputElement,
} from "../../../../ts/input/input-element";
import { isTestActive } from "../../../../ts/states/test";
import { getTypingTestElement } from "../../../../ts/states/test-dom";
import { centerWordsInputEvent } from "../../../../ts/states/words-layout";

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
