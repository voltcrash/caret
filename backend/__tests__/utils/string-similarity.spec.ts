import { describe, expect, it } from "vite-plus/test";
import { compareTwoStrings } from "../../src/utils/string-similarity";

describe("compareTwoStrings", () => {
  it.for([
    ["healed", "sealed", 0.8],
    [
      "Olive-green table for sale, in extremely good condition.",
      "For sale: table in very good  condition, olive green in colour.",
      0.6060606060606061,
    ],
    ["a", "a", 1],
    ["", "", 1],
    ["ab", "a", 0],
    ["french", "quebec", 0],
    ["aaaa", "aa", 0.5],
  ] as const)("compares %j and %j", ([first, second, expected]) => {
    expect(compareTwoStrings(first, second)).toBe(expected);
  });
});
