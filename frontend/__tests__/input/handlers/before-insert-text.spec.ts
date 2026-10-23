import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vite-plus/test";

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

const native = vi.hoisted(() => ({
  session: undefined as
    | import("@oxytype/typing-engine/browser.client").BrowserSession
    | undefined,
}));
vi.mock("../../../src/features/typing/runtime/session.client", () => ({
  getEngineSession: () => ({
    isPrepared: () => native.session !== undefined,
    command: (
      command: import("@oxytype/typing-engine/browser.client").Command,
    ) => native.session?.command(command),
    preflight: (
      data: string,
      layout: import("@oxytype/typing-engine/browser.client").InsertionLayout,
    ) => native.session?.preflight(encodeText(data), layout),
  }),
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
import { nativeSession } from "../../__harness__/native-engine";
import { encodeText } from "@oxytype/typing-engine/text";
import { getMutableConfig } from "../../../src/ts/config/store";
afterEach(() => {
  native.session?.dispose();
  native.session = undefined;
});
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
    native.session = nativeSession(getMutableConfig(), ["hello ", "world"]);
    native.session.command({
      op: "insert",
      data: encodeText("hello"),
      now: 0,
      date: 0,
      correctShiftUsed: null,
      automatic: null,
      isCompositionEnding: null,
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
