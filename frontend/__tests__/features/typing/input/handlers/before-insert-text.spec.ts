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

vi.mock("../../../../../src/features/typing/input/input-element", () => ({
  getInputElementValue: () => ({
    inputValue: mockState.inputValue,
    realInputValue: ` ${mockState.inputValue}`,
  }),
}));

vi.mock("../../../../../src/features/typing/runtime/test/words", () => ({
  words: {
    getCurrent: () => ({
      textWithCommit: mockState.word,
      display: mockState.word.trimEnd(),
    }),
  },
}));

const native = vi.hoisted(() => {
  const state = {
    session: undefined as
      | import("@caret/typing-engine/browser.client").BrowserSession
      | undefined,
    preflight: vi.fn(
      (
        data: string,
        layout: import("@caret/typing-engine/browser.client").InsertionLayout,
      ) => state.session?.preflight(encodeText(data), layout),
    ),
  };
  return state;
});
vi.mock("../../../../../src/features/typing/runtime/session.client", () => ({
  getEngineSession: () => ({
    isPrepared: () => native.session !== undefined,
    command: (command: import("@caret/typing-engine/browser.client").Command) =>
      native.session?.command(command),
    preflight: native.preflight,
  }),
}));
vi.mock("../../../../../src/features/typing/runtime/test/ui", () => ({
  lineState: { activeWordTop: 0, activeWordHeight: 10 },
  getPendingWordData: (): undefined => undefined,
  getActiveWordTopAndHeightWithDifferentData: () => ({
    top: mockState.wrapsToNextLine ? 20 : 0,
    height: 10,
  }),
}));

vi.mock("../../../../../src/ts/states/test", () => ({
  isResultCalculating: () => false,
  isTestRestarting: () => false,
  wordsHaveNewline: () => false,
}));
vi.mock(
  "../../../../../src/features/typing/state/active-word",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../../../src/features/typing/state/active-word")
    >()),
    getActiveWordIndex: () => 0,
  }),
);

vi.mock("../../../../../src/features/typing/input/state", () => ({
  isAwaitingNextWord: () => false,
}));

vi.mock("../../../../../src/features/typing/state/slow-timer", () => ({
  get: () => false,
}));

vi.mock("../../../../../src/features/typing/runtime/funbox/list", () => ({
  isFunboxActiveWithProperty: () => false,
}));

import { onBeforeInsertText } from "../../../../../src/features/typing/input/handlers/before-insert-text";
import { nativeSession } from "../../../../__harness__/native-engine";
import { encodeText } from "@caret/typing-engine/text";
import { peekConfig } from "../../../../../src/ts/config/store";
afterEach(() => {
  native.session?.dispose();
  native.session = undefined;
});
import { __testing } from "../../../../../src/ts/config/testing";

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
    native.session = nativeSession(peekConfig(), ["hello ", "world"]);
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
    native.preflight.mockClear();
    expect(onBeforeInsertText("x")).toBe(true);
    expect(native.preflight).toHaveBeenCalledTimes(2);
    expect(native.preflight).toHaveBeenLastCalledWith(
      "x",
      expect.objectContaining({ wrapped: true }),
    );
  });

  it("allows an extra letter that still fits on the line", () => {
    mockState.wrapsToNextLine = false;
    expect(onBeforeInsertText("x")).toBe(false);
  });

  it("lets a space through to commit the word", () => {
    native.preflight.mockClear();
    expect(onBeforeInsertText(" ")).toBe(false);
    // No overflow measurement means no second engine round trip.
    expect(native.preflight).toHaveBeenCalledTimes(1);
  });

  // android keyboards insert " word" when swipe typing the next word
  it("lets multi character data through, it is checked char by char", () => {
    expect(onBeforeInsertText(" world")).toBe(false);
  });
});
