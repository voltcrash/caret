import { describe, expect, it } from "vite-plus/test";

import {
  createSettingSearchIndex,
  getSettingsSearchHighlights,
  scoreSettingSearch,
  tokenizeSettingsSearch,
} from "../../src/ts/utils/settings-search";

function score(
  query: string,
  setting: Parameters<typeof createSettingSearchIndex>[0],
): number {
  return scoreSettingSearch(
    createSettingSearchIndex(setting),
    tokenizeSettingsSearch(query),
  );
}

describe("settings search relevance", () => {
  it("normalizes case, accents, separators, config keys and repeated words", () => {
    expect(tokenizeSettingsSearch("  FONT-size/fontSize Fónt_size! ")).toEqual([
      "font",
      "size",
    ]);
    expect(tokenizeSettingsSearch("???")).toEqual([]);
    expect(tokenizeSettingsSearch("FPSLimit")).toEqual(["fps", "limit"]);
  });

  it("prefers names and aliases over options, then descriptions", () => {
    const title = score("font", { title: "font size" });
    const alias = score("typeface", { title: "font size" });
    const option = score("font", { title: "other", keywords: "font" });
    const description = score("font", { title: "other", description: "font" });
    expect(title).toBe(alias);
    expect(title).toBeGreaterThan(option);
    expect(option).toBeGreaterThan(description);
  });

  it("keeps related named controls equally relevant for a broad query", () => {
    expect(score("font", { title: "font size" })).toBe(
      score("font", { title: "font family" }),
    );
  });

  it("finds a renamed setting by its config key", () => {
    expect(
      score("timer style", { title: "live progress style", key: "timerStyle" }),
    ).toBeGreaterThan(0);
  });

  it("finds config identifiers without spaces, regardless of case", () => {
    expect(
      score("FONTSIZE", { title: "font size", key: "fontSize" }),
    ).toBeGreaterThan(0);
    expect(
      score("audio", { title: "play time warning", key: "playTimeWarning" }),
    ).toBe(score("audio", { title: "sound volume" }));
  });

  it.each([
    ["cursor", "caret style"],
    ["audio", "sound volume"],
    ["wallpaper", "custom background"],
    ["keyboard", "keymap mode"],
    ["minimum accuracy", "min accuracy"],
    ["colourful", "colorful mode"],
    ["shortcuts", "show key tips"],
    ["frame rate", "animation fps limit"],
  ])("finds %s via a common alias", (query, title) => {
    expect(score(query, { title })).toBeGreaterThan(0);
  });

  it("accepts word prefixes, but not arbitrary interior substrings", () => {
    expect(score("car", { title: "caret style" })).toBeGreaterThan(0);
    expect(score("round", { title: "background" })).toBe(0);
  });

  it("requires every query word, including words from different fields", () => {
    expect(
      score("caret block", {
        title: "caret style",
        keywords: "block underline",
      }),
    ).toBeGreaterThan(0);
    expect(score("font nonsense", { title: "font size" })).toBe(0);
  });

  it.each(["smoth caret", "smooth carret", "smootj caret", "smooh caret"])(
    "tolerates a small typo: %s",
    (query) => {
      expect(score(query, { title: "smooth caret" })).toBeGreaterThan(0);
    },
  );

  it("tolerates transposed letters and two edits in long words", () => {
    expect(score("accruacy", { title: "accuracy" })).toBeGreaterThan(0);
    expect(score("bakgroudn", { title: "background" })).toBeGreaterThan(0);
    expect(score("bckgroudn", { title: "background" })).toBeGreaterThan(0);
    expect(score("bckgrudn", { title: "background" })).toBe(0);
  });

  it("doesn't correct short words, numbers or distant spellings", () => {
    expect(score("cat", { title: "caret" })).toBe(0);
    expect(score("1235", { title: "1234" })).toBe(0);
    expect(score("xarxt", { title: "caret" })).toBe(0);
  });

  it("prefers literal description matches over an unrelated typo in a name", () => {
    expect(score("test", { title: "text" })).toBeLessThan(
      score("test", { title: "difficulty", description: "test difficulty" }),
    );
  });
});

describe("settings search highlights", () => {
  it("highlights the corresponding name for an alias, without expanding descriptions", () => {
    expect(
      getSettingsSearchHighlights("caret style", ["cursor"], true)
        .filter((part) => part.matched)
        .map((part) => part.text),
    ).toEqual(["caret"]);
    expect(
      getSettingsSearchHighlights("caret style", ["cursor"]).some(
        (part) => part.matched,
      ),
    ).toBe(false);
  });

  it("highlights prefixes and corrected words, preserving original text", () => {
    const parts = getSettingsSearchHighlights(
      "Smooth caret — café!",
      tokenizeSettingsSearch("smoth car cafe"),
    );
    expect(
      parts.filter((part) => part.matched).map((part) => part.text),
    ).toEqual(["Smooth", "caret", "café"]);
    expect(parts.map((part) => part.text).join("")).toBe(
      "Smooth caret — café!",
    );
  });

  it("leaves text unchanged for empty queries and literal markup characters", () => {
    const text = "<font> size & family";
    expect(
      getSettingsSearchHighlights(text, []).every((part) => !part.matched),
    ).toBe(true);
    expect(
      getSettingsSearchHighlights(text, ["font"])
        .map((part) => part.text)
        .join(""),
    ).toBe(text);
  });
});
