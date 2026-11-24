import { scrollToCenterOrTop } from "./dimensions";
import {
  blurInputElement,
  focusInputElement,
} from "#features/typing/input/input-element.ts";
import { isTestActive } from "#shared/states/test.ts";
import { getTypingTestElement } from "#shared/states/test-dom.ts";
import { centerWordsInputEvent } from "../../state/words-layout";

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
