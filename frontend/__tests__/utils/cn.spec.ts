import { describe, expect, it } from "vite-plus/test";
import { hasClassName, updateClassNames } from "../../src/ts/utils/cn";

describe("updateClassNames", () => {
  it("adds missing classes once and keeps existing order", () => {
    expect(updateClassNames("a b", "c", true)).toBe("a b c");
    expect(updateClassNames("a b", "b c", true)).toBe("a b c");
    expect(updateClassNames("", "a a", true)).toBe("a");
  });

  it("removes every listed class", () => {
    expect(updateClassNames("a b c", "b", false)).toBe("a c");
    expect(updateClassNames("a b c b", "b c", false)).toBe("a");
    expect(updateClassNames("a", "z", false)).toBe("a");
  });

  it("normalizes surrounding and repeated whitespace", () => {
    expect(updateClassNames("  a   b ", "c", true)).toBe("a b c");
    expect(updateClassNames(" a\tb\n", " b ", false)).toBe("a");
    expect(updateClassNames("a", "  ", true)).toBe("a");
  });

  it("collapses duplicated current classes when adding", () => {
    expect(updateClassNames("a a b", "c", true)).toBe("a b c");
  });
});

describe("hasClassName", () => {
  it("matches whole whitespace-separated tokens only", () => {
    expect(hasClassName("word active", "word")).toBe(true);
    expect(hasClassName("word active", "active")).toBe(true);
    expect(hasClassName("word\tactive\n", "active")).toBe(true);
    expect(hasClassName("wordy active", "word")).toBe(false);
    expect(hasClassName("afterNewline", "Newline")).toBe(false);
    expect(hasClassName("a-word word", "word")).toBe(true);
    expect(hasClassName("", "word")).toBe(false);
    expect(hasClassName("word", "")).toBe(false);
  });
});
