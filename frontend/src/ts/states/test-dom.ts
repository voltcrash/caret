import { createAppOwned } from "../../app/application";
type TestElements = {
  words: HTMLDivElement;
  wordsWrapper: HTMLDivElement;
  wordsInput: HTMLTextAreaElement;
  caret: HTMLDivElement;
  paceCaret: HTMLDivElement;
  typingTest: HTMLDivElement;
  keyboardProxy: HTMLInputElement;
};

const getState = createAppOwned(() => ({
  elements: undefined as TestElements | undefined,
}));

// TestPage owns these native nodes for its lifetime.
export function setTestElements(refs: TestElements): () => void {
  const state = getState();
  state.elements = refs;
  return () => {
    if (state.elements === refs) state.elements = undefined;
  };
}

export function areTestElementsMounted(): boolean {
  return getState().elements !== undefined;
}

function getElement<K extends keyof TestElements>(key: K): TestElements[K] {
  const elements = getState().elements;
  if (elements === undefined) throw new Error("Test page is not mounted");
  return elements[key];
}

export const getWordsElement = (): HTMLDivElement => getElement("words");
export const getWordsWrapperElement = (): HTMLDivElement =>
  getElement("wordsWrapper");
export const getWordsInputElement = (): HTMLTextAreaElement =>
  getElement("wordsInput");
export const getCaretElement = (): HTMLDivElement => getElement("caret");
export const getPaceCaretElement = (): HTMLDivElement =>
  getElement("paceCaret");
export const getTypingTestElement = (): HTMLDivElement =>
  getElement("typingTest");
export const getKeyboardProxyElement = (): HTMLInputElement =>
  getElement("keyboardProxy");
