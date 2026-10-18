import { describe, expect, it, vi } from "vite-plus/test";

vi.mock("virtual:language-hashes", () => ({
  languageHashes: { english: "0123456789abcdef0123456789abcdef" },
}));

import { getLanguageUrl } from "../../src/ts/utils/json-data";

describe("getLanguageUrl", () => {
  it("adds a content hash so cached copies stay valid", () => {
    expect(getLanguageUrl("english")).toBe(
      "/languages/english.json?v=0123456789abcdef",
    );
  });

  it("falls back to the plain URL when no hash is known", () => {
    expect(getLanguageUrl("english_1k")).toBe("/languages/english_1k.json");
  });
});
