import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createHintsNodes } from "../../src/ts/components/pages/test/words/hints";
import * as TestWords from "../../src/ts/test/test-words";

const state = vi.hoisted(() => ({ rtl: false, result: false }));
vi.mock("../../src/ts/config/store", () => ({
  Config: { indicateTypos: "below" },
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
});
