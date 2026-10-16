import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  vi,
} from "vite-plus/test";

// Baseline for the word/letter markup test-ui.ts produces. Asserts the
// `.word > letter` structure + classes only (themes/funbox css target these),
// so it should survive the markup being moved/extracted (P4.6). Words history
// markup moved to test/word-markup.ts + ResultWordsHistory.tsx (P3.8), see
// word-markup.spec.ts and ResultWordsHistory.spec.tsx.

// run animation frames synchronously and let tests await the async callbacks
const frames = vi.hoisted(() => ({ pending: [] as unknown[] }));
vi.mock("../../src/ts/utils/debounced-animation-frame", () => ({
  requestDebouncedAnimationFrame: (_id: string, cb: () => unknown) => {
    frames.pending.push(cb());
  },
  cancelPendingAnimationFrame: () => undefined,
  cancelPendingAnimationFramesStartingWith: () => undefined,
}));

// side-effectful modules unrelated to markup
vi.mock("../../src/ts/controllers/theme-controller", () => ({}));
vi.mock("../../src/ts/controllers/sound-controller", () => ({}));

const testState = vi.hoisted(() => ({ activeWordIndex: 0 }));
vi.mock("../../src/ts/states/test", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getActiveWordIndex: () => testState.activeWordIndex,
  getResultVisible: () => true,
  getLastEventLog: () => [],
}));

import { setTestElements } from "../../src/ts/states/test-dom";
import { __testing } from "../../src/ts/config/testing";
import type { Config as ConfigType } from "@oxytype/schemas/configs";
import { words as TestWords } from "../../src/features/typing/runtime/test-words";

type TestUIModule = typeof import("../../src/features/typing/runtime/test-ui");
let TestUI: TestUIModule;

const { replaceConfig } = __testing;

async function flushFrames(): Promise<void> {
  const pending = frames.pending;
  frames.pending = [];
  await Promise.all(pending);
}

function wordsEl(): HTMLElement {
  return document.querySelector("#words") as HTMLElement;
}

function wordEl(index: number): HTMLElement {
  return wordsEl().querySelector(
    `.word[data-wordindex='${index}']`,
  ) as HTMLElement;
}

/** `[text, className]` per letter; icons are reported by their fa class. */
function letters(word: Element): [string, string][] {
  return [...word.querySelectorAll("letter")].map((l) => {
    const icon = l.querySelector("i");
    const text = icon
      ? ([...icon.classList].find(
          (c) => c.startsWith("fa-") && c !== "fa-fw",
        ) ?? "")
      : (l.textContent ?? "");
    return [text, l.className.trim().replace(/\s+/g, " ")];
  });
}

function setWords(...words: string[]): void {
  TestWords.reset();
  words.forEach((w) => TestWords.push(w, 0));
}

function addWords(): void {
  for (let i = 0; i < TestWords.length; i++) {
    testState.activeWordIndex = i - 1; // appends synchronously
    TestUI.addWord(TestWords.get(i)?.display ?? "", i);
  }
  testState.activeWordIndex = 0;
}

async function type(
  input: string,
  wordIndex = 0,
  compositionData = "",
): Promise<[string, string][]> {
  await TestUI.updateWordLetters({ wordIndex, input, compositionData });
  await flushFrames();
  return letters(wordEl(wordIndex));
}

function config(partial: Partial<ConfigType> = {}): void {
  replaceConfig({
    mode: "words",
    funbox: [],
    tapeMode: "off",
    indicateTypos: "off",
    compositionDisplay: "off",
    showAllLines: true,
    ...partial,
  });
}

beforeAll(async () => {
  // undo the querySelector stub from __harness__/mock-dom.ts
  Reflect.deleteProperty(document, "querySelector");
  document.body.innerHTML = `
    <div class="pageTest">
      <textarea id="wordsInput"></textarea>
      <div id="wordsWrapper"><div id="words"></div></div>
    </div>`;
  setTestElements({
    words: document.querySelector("#words") as HTMLDivElement,
    wordsWrapper: document.querySelector("#wordsWrapper") as HTMLDivElement,
    wordsInput: document.querySelector("#wordsInput") as HTMLTextAreaElement,
    caret: document.createElement("div"),
    paceCaret: document.createElement("div"),
    typingTest: document.createElement("div"),
    keyboardProxy: document.createElement("input"),
  });
  TestUI = await import("../../src/features/typing/runtime/test-ui");
});

beforeEach(() => {
  wordsEl().innerHTML = "";
  frames.pending = [];
  config();
});

describe("test-ui word markup", () => {
  describe("addWord", () => {
    it("renders .word with data-wordindex and one bare letter per char", () => {
      setWords("hello ", "world");
      addWords();

      const words = wordsEl().querySelectorAll(".word");
      expect(words).toHaveLength(2);
      expect(words[0]?.getAttribute("data-wordindex")).toBe("0");
      expect(words[1]?.getAttribute("data-wordindex")).toBe("1");
      expect(letters(wordEl(0))).toEqual([
        ["h", ""],
        ["e", ""],
        ["l", ""],
        ["l", ""],
        ["o", ""],
      ]);
    });

    it("splits multi codepoint characters into single letters", () => {
      setWords("a👍b");
      addWords();
      expect(letters(wordEl(0)).map(([t]) => t)).toEqual(["a", "👍", "b"]);
    });

    it("renders tab and newline as icon letters + newline spacer divs", () => {
      setWords("a\tb\n", "c");
      addWords();

      expect(letters(wordEl(0))).toEqual([
        ["a", ""],
        ["fa-long-arrow-alt-right", "tabChar"],
        ["b", ""],
        ["fa-level-down-alt", "nlChar"],
      ]);
      const after = [...wordsEl().children].map((el) => el.className);
      expect(after).toEqual([
        "word",
        "beforeNewline",
        "newline",
        "afterNewline",
        "word",
      ]);
    });
  });

  describe("updateWordLetters", () => {
    beforeEach(() => {
      setWords("hello ", "world");
      addWords();
    });

    it("leaves untyped letters without class", async () => {
      expect(await type("")).toEqual([
        ["h", ""],
        ["e", ""],
        ["l", ""],
        ["l", ""],
        ["o", ""],
      ]);
    });

    it("marks correct and incorrect letters (target char shown)", async () => {
      expect(await type("hxl")).toEqual([
        ["h", "correct"],
        ["e", "incorrect"],
        ["l", "correct"],
        ["l", ""],
        ["o", ""],
      ]);
    });

    it("marks over-typed letters as incorrect extra", async () => {
      expect(await type("hello!x")).toEqual([
        ["h", "correct"],
        ["e", "correct"],
        ["l", "correct"],
        ["l", "correct"],
        ["o", "correct"],
        ["!", "incorrect extra"],
        ["x", "incorrect extra"],
      ]);
    });

    it("shows extra space as underscore", async () => {
      expect((await type("hello "))[5]).toEqual(["_", "incorrect extra"]);
    });

    it("shows typed char for incorrect letters when indicateTypos is replace", async () => {
      config({ indicateTypos: "replace" });
      expect(await type("hx")).toEqual([
        ["h", "correct"],
        ["x", "incorrect"],
        ["l", ""],
        ["l", ""],
        ["o", ""],
      ]);
    });

    it("renders composition chars as dead letters", async () => {
      expect(await type("h", 0, "e")).toEqual([
        ["h", "correct"],
        ["e", "dead correct"],
        ["l", ""],
        ["l", ""],
        ["o", ""],
      ]);
      expect((await type("h", 0, "x"))[1]).toEqual(["e", "dead"]);
    });

    it("updates only the given word", async () => {
      await type("w", 1);
      expect(letters(wordEl(0)).every(([, c]) => c === "")).toBe(true);
      expect(letters(wordEl(1))[0]).toEqual(["w", "correct"]);
    });
  });

  describe("updateWordLetters (zen)", () => {
    beforeEach(() => {
      config({ mode: "zen" });
      TestWords.reset();
      wordsEl().innerHTML = `<div class='word' data-wordindex='0'></div>`;
    });

    it("marks every typed letter correct", async () => {
      expect(await type("ab")).toEqual([
        ["a", "correct"],
        ["b", "correct"],
      ]);
    });

    it("renders an invisible placeholder when empty", async () => {
      expect(await type("")).toEqual([["_", "invisible"]]);
    });
  });
});

describe("joining word layout", () => {
  beforeEach(async () => {
    config({ typedEffect: "dots" });
    setWords("hello ", "world");
    addWords();
    wordsEl().className = "joiningScript";
    TestUI.updateActiveElement({ initial: true });
    await flushFrames();
  });

  it("freezes an unwrapped typed word width and resets it on return", async () => {
    vi.spyOn(wordEl(0), "getBoundingClientRect").mockReturnValue({
      width: 101.25,
    } as DOMRect);
    testState.activeWordIndex = 1;
    TestUI.updateActiveElement({ direction: "forward" });
    await flushFrames();
    expect(wordEl(0).className).toContain("broken-joining");
    expect(wordEl(0).style.width).toBe("101.25px");
    testState.activeWordIndex = 0;
    TestUI.updateActiveElement({ direction: "back" });
    await flushFrames();
    expect(wordEl(0).className).not.toContain("broken-joining");
    expect(wordEl(0).style.width).toBe("");
  });

  it("keeps wrapped joining words flexible", async () => {
    const secondLetter = wordEl(0).querySelectorAll("letter")[1] as HTMLElement;
    Object.defineProperty(secondLetter, "offsetTop", { value: 20 });
    testState.activeWordIndex = 1;
    TestUI.updateActiveElement({ direction: "forward" });
    await flushFrames();
    expect(wordEl(0).className).toContain("needs-wrap");
    expect(wordEl(0).style.width).toBe("");
  });

  it("leaves ordinary typed words joined", async () => {
    config({ typedEffect: "keep" });
    testState.activeWordIndex = 1;
    TestUI.updateActiveElement({ direction: "forward" });
    await flushFrames();
    expect(wordEl(0).className).not.toContain("broken-joining");
  });
});
