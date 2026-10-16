import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const config = vi.hoisted(() => ({
  mode: "words",
  smoothCaret: "off",
  funbox: [],
  tapeMode: "off",
  tapeMargin: 50,
  blindMode: false,
  hideExtraLetters: false,
}));
vi.mock("../../../../../src/ts/config/store", () => ({
  getMutableConfig: () => config,
}));
vi.mock("../../../../../src/features/typing/runtime/test-words", () => ({
  words: { get: () => ({ display: "ab" }) },
}));
const anime = vi.hoisted(() => ({ animate: vi.fn() }));
vi.mock("animejs", () => ({ animate: anime.animate }));
vi.mock("../../../../../src/ts/utils/debounced-animation-frame", () => ({
  requestDebouncedAnimationFrame: (_key: string, callback: () => void) =>
    callback(),
}));

import { CaretController } from "../../../../../src/features/typing/components/words/caret-controller";
import { setTestElements } from "../../../../../src/ts/states/test-dom";

let element: HTMLDivElement;

function dimensions(el: HTMLElement, values: Record<string, number>): void {
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(el, name, { configurable: true, value });
  }
}

beforeEach(() => {
  config.tapeMode = "off";
  config.smoothCaret = "off";
  anime.animate.mockClear();
  const words = document.createElement("div");
  words.innerHTML =
    '<div class="word" data-wordindex="0"><letter>a</letter><letter>b</letter></div>';
  const word = words.children[0] as HTMLElement;
  word.style.marginLeft = "0px";
  word.style.marginRight = "4px";
  dimensions(word, { offsetLeft: 10, offsetTop: 20, offsetWidth: 16 });
  [...word.children].forEach((letter, index) => {
    dimensions(letter as HTMLElement, {
      offsetLeft: index * 8,
      offsetTop: 0,
      offsetWidth: 8,
      offsetHeight: 24,
    });
  });
  element = document.createElement("div");
  element.id = "caret";
  element.className = "absolute hidden custom";
  dimensions(element, { offsetWidth: 2, offsetHeight: 24 });
  const wordsWrapper = document.createElement("div");
  dimensions(wordsWrapper, { offsetWidth: 200 });
  setTestElements({
    words,
    wordsWrapper,
    wordsInput: document.createElement("textarea"),
    caret: element,
    paceCaret: document.createElement("div"),
    typingTest: document.createElement("div"),
    keyboardProxy: document.createElement("input"),
  });
});

const target = {
  wordIndex: 0,
  isLanguageRightToLeft: false,
  isDirectionReversed: false,
};

describe("native caret", () => {
  it("keeps saved upstream skins visible and supports subsequent style changes", () => {
    element.className += " monkey block";
    const caret = new CaretController(element, "monkey");
    caret.show();
    expect(element.className.split(/\s+/)).toContain("default");
    expect(element.className.split(/\s+/)).not.toContain("monkey");
    expect(element.className.split(/\s+/)).not.toContain("block");
    expect(caret.isHidden()).toBe(false);
    expect(caret.isFullWidth()).toBe(false);
    caret.goTo({ ...target, letterIndex: 1 });
    expect(element.style.left).toBe("17px");

    caret.setStyle("block");
    expect(element.className.split(/\s+/)).toContain("block");
    expect(element.className.split(/\s+/)).not.toContain("default");
    expect(caret.isFullWidth()).toBe(true);
  });

  it("preserves classes and positions before/after letters", () => {
    const caret = new CaretController(element, "default");
    caret.show();
    expect(element.className).toContain("absolute");
    expect(element.className).toContain("custom");
    expect(caret.isHidden()).toBe(false);
    caret.goTo({ ...target, letterIndex: 1 });
    expect(element.style.left).toBe("17px");
    expect(element.style.top).toBe("20px");
    caret.goTo({ ...target, letterIndex: 2 });
    expect(element.style.left).toBe("25px");
    caret.hide();
    expect(caret.isHidden()).toBe(true);
  });

  it("positions full-width underlines and locked letter tape", () => {
    const caret = new CaretController(element, "underline");
    caret.goTo({ ...target, letterIndex: 1 });
    expect(element.style.left).toBe("18px");
    expect(element.style.top).toBe("44px");
    expect(element.style.width).toBe("8px");
    config.tapeMode = "letter";
    caret.setStyle("default");
    caret.goTo({ ...target, letterIndex: 1 });
    expect(element.style.width).toBe("");
    expect(element.style.left).toBe("99px");
  });
});

describe("caret animation", () => {
  afterEach(() => vi.unstubAllGlobals());

  function reduceMotion(matches: boolean): void {
    vi.stubGlobal("matchMedia", () => ({ matches }));
  }

  it.each([
    ["slow", 150],
    ["medium", 100],
    ["fast", 85],
  ] as const)("animates %s smooth caret moves in %ims", (speed, duration) => {
    reduceMotion(false);
    config.smoothCaret = speed;
    const caret = new CaretController(element, "default");
    caret.goTo({ ...target, letterIndex: 1, animate: true });
    expect(anime.animate).toHaveBeenLastCalledWith(element, {
      left: 17,
      top: 20,
      duration,
      ease: "inOut(1.25)",
    });
  });

  it("uses the pace caret's linear timing", () => {
    reduceMotion(false);
    config.smoothCaret = "off";
    const caret = new CaretController(element, "default");
    caret.goTo({
      ...target,
      letterIndex: 1,
      animate: true,
      animationOptions: { duration: 200, easing: "linear" },
    });
    expect(anime.animate).toHaveBeenLastCalledWith(
      element,
      expect.objectContaining({ duration: 200, ease: "linear" }),
    );
  });

  it("drops animation time when reduced motion is preferred", () => {
    reduceMotion(true);
    config.smoothCaret = "slow";
    const caret = new CaretController(element, "default");
    caret.goTo({ ...target, letterIndex: 1, animate: true });
    expect(anime.animate).toHaveBeenLastCalledWith(
      element,
      expect.objectContaining({ duration: 0 }),
    );
    caret.handleLineJump({ newMarginTop: 30, duration: 125 });
    expect(anime.animate).toHaveBeenLastCalledWith(
      element,
      expect.objectContaining({ marginTop: 30, duration: 0 }),
    );
  });

  it("blinks smoothly or hard depending on smooth caret", () => {
    const caret = new CaretController(element, "default");
    config.smoothCaret = "off";
    caret.startBlinking();
    expect(element.style.animationName).toBe("caretFlashHard");
    config.smoothCaret = "fast";
    caret.updateBlinkingAnimation();
    expect(element.style.animationName).toBe("caretFlashSmooth");
    caret.stopBlinking();
    expect(element.style.animationName).toBe("none");
  });
});
