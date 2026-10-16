import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createHintsNodes,
  joinOverlappingHints,
  updateHintsPositionDebounced,
} from "../../src/features/typing/components/words/hints";
import * as TestWords from "../../src/features/typing/runtime/test-words";

const state = vi.hoisted(() => ({ rtl: false, result: false }));
vi.mock("../../src/ts/config/store", () => ({
  getMutableConfig: (() => {
    const storedConfig = { indicateTypos: "below" };
    return () => storedConfig;
  })(),
}));
vi.mock("../../src/ts/states/core", () => ({ getActivePage: () => "test" }));
vi.mock("../../src/ts/states/test", () => ({
  getActiveWordIndex: () => 0,
  isLanguageRightToLeft: () => state.rtl,
  isDirectionReversed: () => false,
  getResultVisible: () => state.result,
}));
vi.mock("../../src/ts/states/test-dom", () => ({
  getWordsElement: () => document.getElementById("words"),
}));
vi.mock("../../src/ts/utils/misc", () => ({
  debounceUntilResolved: (fn: () => Promise<void>) => fn,
}));

function createLetters(count = 3): HTMLElement[] {
  return Array.from({ length: count }, (_, index) => {
    const letter = document.createElement("letter");
    Object.defineProperties(letter, {
      offsetLeft: { value: state.rtl ? (count - index - 1) * 10 : index * 10 },
      offsetWidth: { value: 10 },
      offsetTop: { value: 0, configurable: true },
    });
    return letter;
  });
}
function attachHints(letters: HTMLElement[], input: string): HTMLDivElement {
  const word = document.createElement("div");
  word.className = "word";
  word.append(...letters, createHintsNodes([[0, 1, 2]], letters, input));
  document.getElementById("words")?.append(word);
  return word;
}
function measureHints(word: HTMLElement): void {
  for (const hint of word.querySelectorAll<HTMLElement>("hint")) {
    Object.defineProperties(hint, {
      offsetLeft: { get: () => parseFloat(hint.style.left) },
      offsetWidth: { get: () => (hint.textContent?.length ?? 0) * 20 },
    });
  }
}

beforeEach(() => {
  state.rtl = false;
  state.result = false;
  TestWords.words.reset();
  TestWords.words.push("abc ", 0);
  const words = document.createElement("div");
  words.id = "words";
  document.body.replaceChildren(words);
});

describe("word hints", () => {
  it.each(['<&"', "'&<", "אבג", "عرب"])(
    "keeps hint text literal: %s",
    (input) => {
      const hints = createHintsNodes([[0, 1, 2]], createLetters(), input);
      expect(hints.textContent).toBe(input);
      expect(hints.querySelectorAll("hint")).toHaveLength(3);
      expect(hints.querySelector("hint")?.children).toHaveLength(0);
      expect(hints.querySelector("script, img")).toBeNull();
    },
  );
  it("positions full-word hints using their source indices", () => {
    const hints = createHintsNodes([[1, 2]], createLetters(), "abc");
    expect(hints.textContent).toBe("bc");
    expect(
      Array.from(hints.querySelectorAll<HTMLElement>("hint"), (hint) => [
        hint.dataset["charsIndex"],
        hint.style.left,
      ]),
    ).toEqual([
      ["1", "15px"],
      ["2", "25px"],
    ]);
  });
  it("consumes sparse incorrect-only text in order without a wrapper", () => {
    const hints = createHintsNodes(
      [[0], [2]],
      createLetters(),
      ["<", "&"],
      false,
    );
    expect(hints.querySelector(".hints")).toBeNull();
    expect(hints.textContent).toBe("<&");
    expect(hints.children).toHaveLength(2);
  });
  it.each([false, true])(
    "joins overlapping hints without parsing their text (RTL=%s)",
    async (rtl) => {
      state.rtl = rtl;
      if (rtl) {
        TestWords.words.reset();
        TestWords.words.push("אבג ", 0);
      }
      const letters = createLetters();
      const word = attachHints(letters, '<&"');
      measureHints(word);
      const originalTextNode = word.querySelector("hint")?.firstChild;
      await joinOverlappingHints(
        [[0, 1, 2]],
        letters,
        word.getElementsByTagName("hint"),
      );
      expect(word.querySelectorAll("hint")).toHaveLength(1);
      expect(word.querySelector("hint")?.textContent).toBe('<&"');
      expect(
        word.querySelector<HTMLElement>("hint")?.dataset["charsIndex"],
      ).toBe("0,1,2");
      expect(word.querySelector("hint")?.firstChild).toBe(originalTextNode);
    },
  );
  it("keeps hints on different lines separate", async () => {
    const letters = createLetters();
    const second = letters[1];
    if (second === undefined) throw new Error("Missing letter fixture");
    Object.defineProperty(second, "offsetTop", { value: 20 });
    const word = attachHints(letters, "abc");
    measureHints(word);
    await joinOverlappingHints(
      [[0, 1, 2]],
      letters,
      word.getElementsByTagName("hint"),
    );
    expect(word.querySelectorAll("hint")).toHaveLength(3);
  });
  it("repositions joined special characters without reading encoded HTML", async () => {
    const letters = createLetters();
    const word = attachHints(letters, '<&"');
    measureHints(word);
    await joinOverlappingHints(
      [[0, 1, 2]],
      letters,
      word.getElementsByTagName("hint"),
    );
    await updateHintsPositionDebounced();
    expect(word.querySelector(".hints")?.textContent).toBe('<&"');
    expect(
      Array.from(word.querySelectorAll("hint"), (hint) => hint.textContent),
    ).toEqual(["<", "&", '"']);
    expect(word.querySelector("script, img")).toBeNull();
  });
  it("leaves hints alone when the result is visible", async () => {
    const word = attachHints(createLetters(), "abc");
    const first = word.querySelector("hint");
    state.result = true;
    await updateHintsPositionDebounced();
    expect(word.querySelector("hint")).toBe(first);
  });
});
