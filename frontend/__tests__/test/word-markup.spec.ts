import { describe, expect, it } from "vite-plus/test";

import {
  buildWordLetters,
  buildWordsHistory,
  type WordLetter,
} from "../../src/features/typing/runtime/word-markup";

// ported from the P0.3 test-ui.spec words history baseline

const targets = ["hello ", "world ", "foo ", "bar"];

function history(
  input: string[],
  corrected: string[] = [],
  burst: number[] = [],
  options: { zen?: boolean; timed?: boolean } = {},
): ReturnType<typeof buildWordsHistory> {
  return buildWordsHistory({
    inputHistory: input,
    correctedHistory: corrected,
    burstHistory: burst,
    getTargetWord: (i) => targets[i] ?? "",
    zen: options.zen ?? false,
    timed: options.timed ?? false,
    korean: false,
  });
}

/** `[text, className]` per letter, like the legacy dom baseline. */
const letters = (list: WordLetter[] | undefined): [string, string][] =>
  (list ?? []).map((l) => [l.char, l.classes.join(" ")]);

describe("buildWordsHistory", () => {
  it("marks correct, incorrect, extra and untyped letters", () => {
    const words = history(
      ["hxllo ", "worldzz ", "fo"],
      ["hxllo ", "worldzz ", "fo"],
      [100, 90, 80],
    );

    expect(letters(words[0]?.letters)).toEqual([
      ["h", "correct"],
      ["e", "incorrect"],
      ["l", "correct"],
      ["l", "correct"],
      ["o", "correct"],
    ]);
    expect(letters(words[1]?.letters)).toEqual([
      ["w", "correct"],
      ["o", "correct"],
      ["r", "correct"],
      ["l", "correct"],
      ["d", "correct"],
      ["z", "incorrect extra"],
      ["z", "incorrect extra"],
    ]);
    // untyped tail of the last word keeps a bare letter
    expect(letters(words[2]?.letters)).toEqual([
      ["f", "correct"],
      ["o", "correct"],
      ["o", ""],
    ]);
  });

  it("marks letters fixed during typing as corrected", () => {
    const [word] = history(["hello "], ["hxllo "]);

    expect(letters(word?.letters)[1]).toEqual(["e", "corrected"]);
  });

  it("sets error/typed flags and input/burst values", () => {
    const words = history(["hxllo ", "world "], ["", ""], [100, 90]);

    // input + 2 trailing words are rendered
    expect(words).toHaveLength(4);
    expect(words[0]).toMatchObject({
      typed: true,
      error: true,
      input: "hxllo",
      burst: 100,
    });
    expect(words[1]).toMatchObject({ typed: true, error: false });
    expect(words[2]).toMatchObject({
      typed: false,
      error: false,
      input: "",
      burst: undefined,
    });
    expect(letters(words[2]?.letters)).toEqual([
      ["f", ""],
      ["o", ""],
      ["o", ""],
    ]);
  });

  it("does not mark a partially typed last word in timed tests", () => {
    expect(history(["hel"], [], [], { timed: true })[0]?.error).toBe(false);
    expect(history(["hel"])[0]?.error).toBe(true);
  });

  it("never marks errors in zen mode", () => {
    const [word] = buildWordsHistory({
      inputHistory: ["xyz "],
      correctedHistory: [],
      burstHistory: [],
      getTargetWord: () => "",
      zen: true,
      timed: false,
      korean: false,
    });
    expect(word?.error).toBe(false);
    expect(letters(word?.letters)).toEqual([
      ["x", "correct"],
      ["y", "correct"],
      ["z", "correct"],
    ]);
  });
});

describe("buildWordLetters", () => {
  it("marks a trailing corrected extra", () => {
    expect(
      letters(
        buildWordLetters("ab", "abc", "ab", { zen: false, korean: false }),
      ),
    ).toEqual([
      ["a", "correct"],
      ["b", "correct extraCorrected"],
    ]);
  });

  it("renders typed spaces as underscores", () => {
    expect(
      letters(
        buildWordLetters("a b", undefined, "a", { zen: false, korean: false }),
      ),
    ).toEqual([
      ["a", "correct"],
      ["_", "incorrect extra"],
      ["b", "incorrect extra"],
    ]);
  });
});
