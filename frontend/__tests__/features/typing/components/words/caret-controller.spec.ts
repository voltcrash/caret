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
  peekConfig: () => config,
}));
vi.mock("../../../../../src/features/typing/runtime/test/words", () => ({
  words: { get: () => ({ display: "ab" }) },
}));
const anime = vi.hoisted(() => ({ animate: vi.fn() }));
vi.mock("animejs", async (original) => ({
  ...(await original<typeof import("animejs")>()),
  animate: anime.animate,
}));
vi.mock("../../../../../src/ts/utils/debounced-animation-frame", () => ({
  requestDebouncedAnimationFrame: (_key: string, callback: () => void) =>
    callback(),
}));

import { CaretController } from "../../../../../src/features/typing/components/words/caret-controller";
import { caretGlideEasing } from "../../../../../src/features/typing/components/words/caret-easing";
import { setTestElements } from "../../../../../src/features/typing/state/test-dom";

let element: HTMLDivElement;
let wordsElement: HTMLDivElement;

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
  wordsElement = words;
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
  // Animations only exist on rendered elements.
  wordsWrapper.append(words, element);
  document.body.replaceChildren(wordsWrapper);
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

/** The caret's inline translate, as `[left, top]`. */
function position(): number[] {
  const [x = "0px", y = "0px"] = element.style.translate.split(" ");
  return [parseFloat(x), parseFloat(y)];
}

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
    expect(position()[0]).toBe(17);

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
    expect(position()).toEqual([17, 20]);
    caret.goTo({ ...target, letterIndex: 2 });
    expect(position()).toEqual([25, 20]);
    caret.hide();
    expect(caret.isHidden()).toBe(true);
  });

  it("reuses the cached word element across moves", () => {
    const caret = new CaretController(element, "default");
    caret.goTo({ ...target, letterIndex: 0 });
    const query = vi.spyOn(wordsElement, "querySelector");
    caret.goTo({ ...target, letterIndex: 1 });
    caret.goTo({ ...target, letterIndex: 2 });
    expect(query).not.toHaveBeenCalled();
    expect(position()[0]).toBe(25);
  });

  it("falls back to the closest visible letter and clamps past the end", () => {
    const caret = new CaretController(element, "default");
    const second = wordsElement.querySelectorAll("letter")[1] as HTMLElement;
    dimensions(second, { offsetWidth: 0 });
    caret.goTo({ ...target, letterIndex: 1 });
    expect(position()[0]).toBe(9);
    caret.goTo({ ...target, letterIndex: 9 });
    expect(position()[0]).toBe(17);
  });

  it("positions full-width underlines and locked letter tape", () => {
    const caret = new CaretController(element, "underline");
    caret.goTo({ ...target, letterIndex: 1 });
    expect(position()).toEqual([18, 44]);
    expect(element.style.width).toBe("8px");
    config.tapeMode = "letter";
    caret.setStyle("default");
    caret.goTo({ ...target, letterIndex: 1 });
    expect(element.style.width).toBe("");
    expect(position()[0]).toBe(99);
  });
});

describe("caret animation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const animation of element.getAnimations()) animation.cancel();
  });

  function reduceMotion(matches: boolean): void {
    vi.stubGlobal("matchMedia", () => ({ matches }));
  }

  function glide(): {
    duration: unknown;
    easing: string;
    keyframes: unknown[];
  } {
    const animations = element.getAnimations();
    expect(animations).toHaveLength(1);
    const effect = animations[0]?.effect as KeyframeEffect;
    return {
      duration: effect.getTiming().duration,
      easing: effect.getTiming().easing ?? "",
      keyframes: effect.getKeyframes().map((frame) => frame["translate"]),
    };
  }

  it.each([
    ["slow", 150],
    ["medium", 100],
    ["fast", 85],
  ] as const)("glides %s smooth caret moves in %ims", (speed, duration) => {
    reduceMotion(false);
    config.smoothCaret = speed;
    const caret = new CaretController(element, "default");
    caret.goTo({ ...target, letterIndex: 0 });
    caret.goTo({ ...target, letterIndex: 1, animate: true });
    expect(glide()).toEqual({
      duration,
      easing: caretGlideEasing.css,
      keyframes: ["9px 20px", "17px 20px"],
    });
    // The final position is inline, so nothing jumps when the glide ends.
    expect(position()).toEqual([17, 20]);
    expect(anime.animate).not.toHaveBeenCalled();
  });

  it("keeps gliding toward an unchanged target", () => {
    reduceMotion(false);
    config.smoothCaret = "slow";
    const caret = new CaretController(element, "default");
    caret.goTo({ ...target, letterIndex: 0 });
    caret.goTo({ ...target, letterIndex: 1, animate: true });
    const first = element.getAnimations()[0];
    caret.goTo({ ...target, letterIndex: 1, animate: true });
    expect(element.getAnimations()).toEqual([first]);
  });

  it("retargets from where the caret is drawn", () => {
    reduceMotion(false);
    config.smoothCaret = "slow";
    const caret = new CaretController(element, "default");
    caret.goTo({ ...target, letterIndex: 0 });
    caret.goTo({ ...target, letterIndex: 1, animate: true });
    const first = element.getAnimations()[0] as Animation;
    first.pause();
    first.currentTime = 75;
    const drawn = parseFloat(getComputedStyle(element).translate);
    caret.goTo({ ...target, letterIndex: 2, animate: true });
    const [from] = glide().keyframes as string[];
    expect(parseFloat(from ?? "")).toBeCloseTo(drawn, 1);
    expect(first.playState).toBe("idle");
  });

  it("glides full-width carets to the new letter width", () => {
    reduceMotion(false);
    config.smoothCaret = "slow";
    const caret = new CaretController(element, "block");
    const second = wordsElement.querySelectorAll("letter")[1] as HTMLElement;
    dimensions(second, { offsetWidth: 12 });
    caret.goTo({ ...target, letterIndex: 0 });
    expect(element.style.width).toBe("8px");
    caret.goTo({ ...target, letterIndex: 1, animate: true });
    expect(element.style.width).toBe("12px");
    const width = element
      .getAnimations()
      .map((animation) => (animation.effect as KeyframeEffect).getKeyframes())
      .find((frames) => frames[0]?.["width"] !== undefined);
    expect(width?.map((frame) => frame["width"])).toEqual(["8px", "12px"]);
  });

  it("uses the pace caret's linear timing", () => {
    reduceMotion(false);
    config.smoothCaret = "off";
    const caret = new CaretController(element, "default");
    caret.goTo({ ...target, letterIndex: 0 });
    caret.goTo({
      ...target,
      letterIndex: 1,
      animate: true,
      animationOptions: { duration: 200, easing: "linear" },
    });
    expect(glide()).toMatchObject({ duration: 200, easing: "linear" });
  });

  it("drops animation time when reduced motion is preferred", () => {
    reduceMotion(true);
    config.smoothCaret = "slow";
    const caret = new CaretController(element, "default");
    caret.goTo({ ...target, letterIndex: 0 });
    caret.goTo({ ...target, letterIndex: 1, animate: true });
    expect(element.getAnimations()).toHaveLength(0);
    expect(position()).toEqual([17, 20]);
    caret.handleLineJump({ newMarginTop: 30, duration: 125 });
    expect(anime.animate).toHaveBeenLastCalledWith(
      element,
      expect.objectContaining({ marginTop: 30, duration: 0 }),
    );
  });

  it("folds a finished line jump into the glide", () => {
    reduceMotion(false);
    config.smoothCaret = "off";
    // The main caret ignores instant line jumps.
    element.id = "paceCaret";
    const caret = new CaretController(element, "default");
    caret.goTo({ ...target, letterIndex: 0 });
    caret.handleLineJump({ newMarginTop: -24, duration: 0 });
    expect(element.style.marginTop).toBe("-24px");
    caret.goTo({ ...target, letterIndex: 1 });
    expect(element.style.marginTop).toBe("0px");
    expect(position()).toEqual([17, 20]);
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
