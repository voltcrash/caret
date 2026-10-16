import {
  areTestElementsMounted,
  getKeyboardProxyElement,
  getWordsInputElement,
} from "../states/test-dom";
import { isCoarsePointer } from "../utils/pointer";

export function getInputElement(): HTMLTextAreaElement {
  return getWordsInputElement();
}

export function setInputElementValue(value: string): void {
  getInputElement().value = ` ${value}`;
}

export function appendToInputElementValue(value: string): void {
  getInputElement().value += value;
}

export function getInputElementValue(): {
  inputValue: string;
  realInputValue: string;
} {
  return {
    inputValue: getInputElement().value.slice(1),
    realInputValue: getInputElement().value,
  };
}

export function moveInputElementCaretToTheEnd(): void {
  getInputElement().setSelectionRange(
    getInputElement().value.length,
    getInputElement().value.length,
  );
}

export function replaceInputElementLastValueChar(char: string): void {
  const { inputValue } = getInputElementValue();
  setInputElementValue(inputValue.slice(0, -1) + char);
}

export function isInputElementFocused(): boolean {
  return (
    areTestElementsMounted() && document.activeElement === getInputElement()
  );
}

export function focusInputElement(preventScroll = false): void {
  getInputElement().focus({
    preventScroll,
  });
}

// ios only raises the keyboard for focus() inside a tap. restarting from the
// result screen focuses the words input after its fade, so a visible proxy
// takes the focus during the tap and hands it over (keyboard stays up)
export function holdKeyboardForRestart(): void {
  if (!isCoarsePointer()) return;
  getKeyboardProxyElement().focus({ preventScroll: true });
}

// on touch the keyboard is only up if the user focused the input (or the
// proxy) with a tap. focus() outside a tap focuses without a keyboard
export function isTouchKeyboardFocused(): boolean {
  return (
    areTestElementsMounted() &&
    (document.activeElement === getInputElement() ||
      document.activeElement === getKeyboardProxyElement())
  );
}

export function blurInputElement(): void {
  getInputElement().blur();
}
