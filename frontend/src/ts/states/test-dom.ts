type TestElements = {
  words: HTMLDivElement;
  wordsWrapper: HTMLDivElement;
  wordsInput: HTMLTextAreaElement;
  caret: HTMLDivElement;
  paceCaret: HTMLDivElement;
  typingTest: HTMLDivElement;
  keyboardProxy: HTMLInputElement;
};

let elements: TestElements | undefined;

// TestPage owns these native nodes for its lifetime.
export function setTestElements(refs: TestElements): void {
  elements = refs;
}

export function areTestElementsMounted(): boolean {
  return elements !== undefined;
}

function getElement<K extends keyof TestElements>(key: K): TestElements[K] {
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
