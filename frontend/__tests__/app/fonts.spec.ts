import { beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ file: vi.fn(), language: vi.fn() }));
vi.mock("../../src/ts/utils/file-storage", () => ({
  default: { getFile: mocks.file },
}));
vi.mock("../../src/ts/utils/json-data", () => ({
  getLanguage: mocks.language,
}));

import { applyFontFamily } from "../../src/app/fonts.client";
import { getMutableConfig } from "../../src/ts/config/store";
import { getFontFace, getFontFamily } from "../../src/ts/states/app";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(getMutableConfig(), {
    fontFamily: "Roboto_Mono",
    language: "english",
  });
});

it("starts language loading while IndexedDB is still pending", async () => {
  const file = Promise.withResolvers<undefined>();
  mocks.file.mockReturnValue(file.promise);
  mocks.language.mockResolvedValue({ preferredFont: "Noto_Naskh_Arabic" });
  const applied = applyFontFamily();
  expect(mocks.file).toHaveBeenCalledOnce();
  expect(mocks.language).toHaveBeenCalledWith("english");
  file.resolve(undefined);
  await applied;
  expect(getFontFamily()).toContain('"Roboto Mono","Noto Naskh Arabic"');
  expect(getFontFace()).toBe("");
});

it("ignores an obsolete language/font selection after IO completes", async () => {
  const file = Promise.withResolvers<string>();
  mocks.file.mockReturnValue(file.promise);
  mocks.language.mockResolvedValue({});
  const previous = getFontFamily();
  const applied = applyFontFamily();
  getMutableConfig().fontFamily = "Fira_Code";
  file.resolve("data:font/woff2;base64,fixture");
  await applied;
  expect(getFontFamily()).toBe(previous);
});
