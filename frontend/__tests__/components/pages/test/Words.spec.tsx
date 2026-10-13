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
import {
  getWordsInputStyle,
  getWordsWrapperHeight,
} from "../../../../src/ts/states/words-layout";
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
  el.getBoundingClientRect = () =>
    new DOMRect(el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight);
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
  document.documentElement.style.fontSize = "16px";
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
    typedEffect: "keep",
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

async function layout(): Promise<void> {
  ui.onTestRestart("testPage");
  await flushFrames();
  for (let index = 0; index < words.length; index++) {
    const el = word(index);
    Object.assign(el.style, {
      marginTop: "0px",
      marginBottom: "0px",
      marginLeft: "0px",
      marginRight: "0px",
    });
    size(el, {
      offsetTop: 10,
      offsetLeft: 50 + 110 * index,
      offsetWidth: 100,
      offsetHeight: 20,
    });
  }
  size(element, { offsetWidth: 400, offsetHeight: 20 });
}

describe("Words layout", () => {
  it("positions the input over its active word", async () => {
    await layout();
    ui.updateWordsInputPosition();
    expect(getWordsInputStyle()).toMatchObject({
      top: "9px",
      left: "50px",
      width: "100px",
      "max-width": "",
    });
  });

  it("respects tape margin and right-to-left narrow words", async () => {
    await layout();
    Config.tapeMode = "word";
    Config.tapeMargin = 25;
    ui.updateWordsInputPosition();
    expect(getWordsInputStyle()).toMatchObject({
      left: "100px",
      "max-width": "75%",
    });
    Config.tapeMode = "off";
    mocks.rtl = true;
    size(word(0), { offsetWidth: 4 });
    ui.updateWordsInputPosition();
    expect(getWordsInputStyle()).toMatchObject({ left: "34px", width: "16px" });
    mocks.reversed = true;
    ui.updateWordsInputPosition();
    expect(getWordsInputStyle().left).toBe("50px");
  });

  it("resets missing active word coordinates and ignores other pages", async () => {
    await layout();
    ui.updateWordsInputPosition();
    mocks.activePage = "account";
    ui.clearWords();
    ui.updateWordsInputPosition();
    expect(getWordsInputStyle().left).toBe("50px");
    mocks.activePage = "test";
    ui.updateWordsInputPosition();
    expect(getWordsInputStyle()).toMatchObject({ top: "0px", left: "0px" });
  });

  it("keeps three lines, grows with show-all-lines, and uses two for zen", async () => {
    await layout();
    ui.updateWordsWrapperHeight(true);
    expect(getWordsWrapperHeight()).toBe("60px");
    Config.showAllLines = true;
    ui.updateWordsWrapperHeight(true);
    expect(getWordsWrapperHeight()).toBe("");
    Config.showAllLines = false;
    Config.mode = "zen";
    ui.updateWordsWrapperHeight(true);
    expect(getWordsWrapperHeight()).toBe("40px");
    Config.tapeMode = "word";
    Config.mode = "words";
    ui.updateWordsWrapperHeight(true);
    expect(getWordsWrapperHeight()).toBe("20px");
  });

  it("scrolls tape and both carets by the configured margin", async () => {
    await layout();
    Config.tapeMode = "word";
    Config.tapeMargin = 25;
    mocks.activeIndex = 1;
    await ui.scrollTape(true);
    expect(element.style.marginLeft).toBe("0px");
    expect(mocks.caret.handleTapeScroll).toHaveBeenLastCalledWith({
      newValue: -100,
      duration: 0,
      ease: "inOut(1.25)",
    });
    mocks.resultVisible = true;
    mocks.caret.handleTapeScroll.mockClear();
    await ui.scrollTape();
    expect(mocks.caret.handleTapeScroll).not.toHaveBeenCalled();
  });

  it("scrolls tape by typed letter widths", async () => {
    await layout();
    Config.tapeMode = "letter";
    Config.tapeMargin = 25;
    mocks.input = "he";
    for (const letter of word(0).querySelectorAll<HTMLElement>("letter")) {
      size(letter, { offsetWidth: 10 });
    }
    await ui.scrollTape(true);
    expect(element.style.marginLeft).toBe("80px");
  });

  it("removes completed lines after the first line jump", async () => {
    words.push("third", 0);
    await layout();
    size(word(1), { offsetTop: 30 });
    size(word(2), { offsetTop: 50 });
    mocks.activeIndex = 1;
    ui.updateActiveElement({ direction: "forward" });
    await flushFrames();
    expect(word(0)).not.toBeNull();
    mocks.activeIndex = 2;
    ui.updateActiveElement({ direction: "forward" });
    await flushFrames();
    expect(word(0)).toBeNull();
    expect(word(2)).toHaveClass("active");
    expect(ui.activeWordTop).toBe(50);
    expect(ui.activeWordHeight).toBe(20);
    expect(mocks.caret.handleLineJump).toHaveBeenCalledWith({
      newMarginTop: -20,
      duration: 0,
    });
  });

  it("centers an active line on demand", async () => {
    words.push("third", 0);
    await layout();
    size(word(1), { offsetTop: 30 });
    size(word(2), { offsetTop: 50 });
    mocks.activeIndex = 2;
    await ui.centerActiveLine();
    expect(word(0)).toBeNull();
    expect(word(1)).not.toBeNull();
  });
});
