import { cleanup, render } from "@solidjs/testing-library";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  activeIndex: 0,
  rtl: false,
  reversed: false,
  resultVisible: false,
  activePage: "test",
  caret: {
    handleTapeScroll: vi.fn(),
    handleTapeWordsRemoved: vi.fn(),
    handleLineJump: vi.fn(),
  },
  sound: {
    playClick: vi.fn(),
    playError: vi.fn(),
    clearAllSounds: vi.fn(),
    playFartReverb: vi.fn(),
  },
  focus: vi.fn(),
  power: vi.fn(),
  highlight: vi.fn(),
  input: "",
  accuracy: 97.456,
}));

vi.mock("../../../../src/ts/states/test", () => ({
  getActiveWordIndex: () => mocks.activeIndex,
  isDirectionReversed: () => mocks.reversed,
  isLanguageRightToLeft: () => mocks.rtl,
  getResultVisible: () => mocks.resultVisible,
  isTestActive: () => false,
  wordsHaveNewline: () => false,
  setCompositionText: vi.fn(),
  setCurrentLiveStats: vi.fn(),
  setOutOfFocusMaxHeight: vi.fn(),
  setTestFocusState: vi.fn(),
  setTestInitError: vi.fn(),
}));
vi.mock("../../../../src/ts/states/core", () => ({
  getActivePage: () => mocks.activePage,
}));
vi.mock("../../../../src/ts/states/background", () => ({
  getBackground: () => ({ url: "" }),
}));
vi.mock("../../../../src/ts/states/result", () => ({
  setResultState: vi.fn(),
  getResultElement: () => document.createElement("div"),
}));
vi.mock("../../../../src/ts/states/funbox", () => ({
  setWordsWrapperVisible: vi.fn(),
}));
vi.mock("../../../../src/ts/states/composition", () => ({
  getData: () => "",
}));
vi.mock("../../../../src/ts/states/connection", () => ({
  get: () => true,
  showOfflineBanner: vi.fn(),
}));
vi.mock("../../../../src/ts/states/header", () => ({
  skipBreakdownEvent: { dispatch: vi.fn() },
}));
vi.mock("../../../../src/ts/states/slow-timer", () => ({
  get: () => false,
}));
vi.mock("../../../../src/ts/controllers/sound-controller", () => mocks.sound);
vi.mock("../../../../src/ts/controllers/theme-controller", () => ({
  randomizeTheme: vi.fn(),
}));
vi.mock("../../../../src/ts/events/keymap", () => ({
  highlight: mocks.highlight,
}));
vi.mock("../../../../src/ts/hooks/useWordsFocus", () => ({
  useWordsFocus: vi.fn(),
}));
vi.mock("../../../../src/ts/test/focus", () => ({ set: mocks.focus }));
vi.mock("../../../../src/ts/test/caret", () => ({
  getCaret: () => mocks.caret,
  updatePosition: vi.fn(),
  stopAnimation: vi.fn(),
  resetPosition: vi.fn(),
  hide: vi.fn(),
}));
vi.mock("../../../../src/ts/test/pace-caret", () => ({
  getCaret: () => mocks.caret,
  resetCaretPosition: vi.fn(),
}));
vi.mock("../../../../src/ts/test/custom-text", () => ({
  getLimitMode: () => "word",
  getLimitValue: () => 15,
}));
vi.mock("../../../../src/ts/test/funbox/list", () => ({
  findSingleActiveFunboxWithFunction: () => undefined,
}));
vi.mock("../../../../src/ts/test/funbox/layoutfluid-funbox-timer", () => ({
  instantHide: vi.fn(),
}));
vi.mock("../../../../src/ts/test/events/data", () => ({
  getCurrentInput: () => mocks.input,
}));
vi.mock("../../../../src/ts/test/events/live-cache", () => ({
  getLiveCachedAccuracy: () => mocks.accuracy,
}));
vi.mock("../../../../src/ts/components/pages/test/MonkeyPower", () => ({
  addPower: mocks.power,
  reset: vi.fn(),
}));
vi.mock("../../../../src/ts/anim", () => ({
  animateAsync: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("animejs", () => ({ animate: vi.fn() }));

import { Words } from "../../../../src/ts/components/pages/test/Words";
import { Config } from "../../../../src/ts/config/store";
import { setTestElements } from "../../../../src/ts/states/test-dom";
import * as ui from "../../../../src/ts/test/test-ui";
import { words } from "../../../../src/ts/test/test-words";

let element: HTMLDivElement;
let wrapper: HTMLDivElement;
let input: HTMLTextAreaElement;
let frames: Map<number, (now: number) => unknown>;

function size(
  el: HTMLElement,
  values: Partial<
    Record<"offsetTop" | "offsetLeft" | "offsetWidth" | "offsetHeight", number>
  >,
): void {
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(el, key, { configurable: true, value });
  }
}

function word(index: number): HTMLElement {
  return element.querySelector<HTMLElement>(
    `.word[data-wordindex='${index}']`,
  ) as HTMLElement;
}

async function flushFrames(): Promise<void> {
  while (frames.size > 0) {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) await callback(0);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mocks, {
    activeIndex: 0,
    rtl: false,
    reversed: false,
    resultVisible: false,
    activePage: "test",
    input: "",
    accuracy: 97.456,
  });
  Object.assign(Config, {
    mode: "words",
    words: 15,
    fontSize: 1,
    tapeMode: "off",
    showAllLines: false,
    smoothLineScroll: false,
    blindMode: false,
    hideExtraLetters: false,
    indicateTypos: "off",
    compositionDisplay: "off",
    typedEffect: "off",
    keymapMode: "off",
    playSoundOnError: "1",
  });
  words.reset();
  words.push("hello ", 0);
  words.push("world", 0);
  frames = new Map();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  wrapper = document.createElement("div");
  input = document.createElement("textarea");
  input.scrollIntoView = vi.fn();
  wrapper.scrollIntoView = vi.fn();
  const mounted = render(() => (
    <Words
      ref={(el) => {
        element = el;
      }}
    />
  ));
  wrapper.append(input, mounted.container);
  document.body.append(wrapper);
  setTestElements({
    words: element,
    wordsWrapper: wrapper,
    wordsInput: input,
    typingTest: wrapper,
    caret: document.createElement("div"),
    paceCaret: document.createElement("div"),
    keyboardProxy: document.createElement("input"),
  });
  size(wrapper, { offsetWidth: 400 });
  size(input, { offsetHeight: 20 });
});

afterEach(() => {
  cleanup();
  wrapper.remove();
  words.reset();
  vi.unstubAllGlobals();
});

describe("Words rendering", () => {
  it("renders initial words and activates the first on restart", async () => {
    ui.onTestRestart("testPage");
    await flushFrames();
    expect(element.querySelectorAll(".word")).toHaveLength(2);
    expect(word(0).textContent).toBe("hello");
    expect(word(0)).toHaveClass("active");
    expect(word(1).textContent).toBe("world");
  });

  it("coalesces letter updates and marks incorrect and extra letters", async () => {
    ui.onTestRestart("testPage");
    await flushFrames();
    await ui.updateWordLetters({
      wordIndex: 0,
      input: "h",
      compositionData: "",
    });
    await ui.updateWordLetters({
      wordIndex: 0,
      input: "hxlloz",
      compositionData: "",
    });
    expect(ui.pendingWordData.get(0)).toBe("hxlloz");
    await flushFrames();
    expect(ui.pendingWordData.has(0)).toBe(false);
    const letters = [...word(0).querySelectorAll("letter")];
    expect(
      letters.map((letter) => [letter.textContent, letter.className.trim()]),
    ).toEqual([
      ["h", "correct"],
      ["e", "incorrect"],
      ["l", "correct"],
      ["l", "correct"],
      ["o", "correct"],
      ["z", "incorrect extra"],
    ]);
  });

  it("appends the next word immediately and cancels queued work on unmount", () => {
    ui.addWord("next", 1);
    expect(word(1).textContent).toBe("next");
    ui.addWord("later", 5);
    void ui.updateWordLetters({
      wordIndex: 1,
      input: "n",
      compositionData: "",
    });
    expect(frames.size).toBe(2);
    cleanup();
    expect(frames.size).toBe(0);
    expect(ui.pendingWordData.size).toBe(0);
  });
});
