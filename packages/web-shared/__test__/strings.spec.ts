import { describe, it, expect } from "vite-plus/test";
import {
  capitalizeFirstLetterOfEachWord,
  getLastChar,
  removeLanguageSize,
  replaceCharAt,
  replaceSpecialChars,
  splitIntoCharacters,
} from "../src/strings";

describe("strings", () => {
  it("removes accents", () => {
    expect(replaceSpecialChars("café naïve")).toBe("cafe naive");
  });

  it("gets the last char", () => {
    expect(getLastChar("word.")).toBe(".");
    expect(getLastChar("")).toBe("");
  });

  it("replaces a char", () => {
    expect(replaceCharAt("abcd", 1, ".")).toBe("a.cd");
    expect(replaceCharAt("abcd", 9, ".")).toBe("abcd");
  });

  it("capitalizes each word", () => {
    expect(capitalizeFirstLetterOfEachWord("hello  big world")).toBe(
      "Hello Big World",
    );
  });

  it("removes the language size", () => {
    expect(removeLanguageSize("english_10k")).toBe("english");
    expect(removeLanguageSize("english")).toBe("english");
    expect(removeLanguageSize("code_c++")).toBe("code_c++");
  });

  it("splits characters outside of the bmp", () => {
    expect(splitIntoCharacters("abc")).toEqual(["a", "b", "c"]);
    expect(splitIntoCharacters("t𐑩e")).toEqual(["t", "𐑩", "e"]);
  });
});
