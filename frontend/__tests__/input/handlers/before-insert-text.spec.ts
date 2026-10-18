import { describe, it, expect, beforeEach, vi } from "vite-plus/test";

const mockState = vi.hoisted(() => ({
  inputValue: "",
  currentInput: "",
  word: "hello ",
  // what the active word would measure after appending the data
  wrapsToNextLine: false,
}));

vi.mock("../../../src/ts/input/input-element", () => ({
  getInputElementValue: () => ({
    inputValue: mockState.inputValue,
    realInputValue: ` ${mockState.inputValue}`,
  }),
}));

vi.mock("../../../src/features/typing/runtime/test-words", () => ({
  words: {
    getCurrent: () => ({
      textWithCommit: mockState.word,
      display: mockState.word.trimEnd(),
    }),
  },
}));

vi.mock("../../../src/features/typing/runtime/events/data", () => ({
  getCurrentInput: () => mockState.currentInput,
}));

vi.mock("../../../src/features/typing/runtime/test-ui", () => ({
  activeWordTop: 0,
  activeWordHeight: 10,
  pendingWordData: new Map<number, string>(),
  getActiveWordTopAndHeightWithDifferentData: () => ({
    top: mockState.wrapsToNextLine ? 20 : 0,
    height: 10,
  }),
}));

vi.mock("../../../src/ts/states/test", () => ({
  getActiveWordIndex: () => 0,
  isResultCalculating: () => false,
  isTestRestarting: () => false,
  wordsHaveNewline: () => false,
}));

vi.mock("../../../src/ts/input/state", () => ({
  isAwaitingNextWord: () => false,
}));

vi.mock("../../../src/ts/states/slow-timer", () => ({ get: () => false }));

vi.mock("../../../src/features/typing/runtime/funbox/list", () => ({
  isFunboxActiveWithProperty: () => false,
}));

import { onBeforeInsertText } from "../../../src/ts/input/handlers/before-insert-text";
import { __testing } from "../../../src/ts/config/testing";

const { replaceConfig } = __testing;

describe("onBeforeInsertText - line overflow", () => {
  beforeEach(() => {
    mockState.inputValue = "hello";
    mockState.currentInput = "hello";
    mockState.word = "hello ";
    mockState.wrapsToNextLine = true;
    replaceConfig({
      mode: "words",
      language: "english",
      blindMode: false,
      hideExtraLetters: false,
      deleteOnError: "off",
      difficulty: "normal",
      strictSpace: false,
    });
  });

  it("blocks an extra letter that would push the word onto the next line", () => {
    expect(onBeforeInsertText("x")).toBe(true);
  });

  it("lets a space through to commit the word", () => {
    expect(onBeforeInsertText(" ")).toBe(false);
  });

  // android keyboards insert " word" when swipe typing the next word
  it("lets multi character data through, it is checked char by char", () => {
    expect(onBeforeInsertText(" world")).toBe(false);
  });
});
