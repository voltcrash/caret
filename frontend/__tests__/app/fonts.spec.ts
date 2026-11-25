import { beforeEach, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => ({ file: vi.fn(), language: vi.fn() }));
vi.mock("../../src/ts/utils/file-storage", () => ({
  default: { getFile: mocks.file },
}));
vi.mock("../../src/ts/utils/json-data", () => ({
  getLanguage: mocks.language,
}));

import { applyFontFamily } from "../../src/app/fonts.client";
import { peekConfig, setConfigStore } from "../../src/ts/config/store";
import { getFontFace, getFontFamily } from "../../src/ts/states/app";

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(peekConfig(), {
    fontFamily: "Roboto_Mono",
    language: "english",
  });
});

it("skips language loading for default english", async () => {
  mocks.file.mockResolvedValue(undefined);
  await applyFontFamily();
  expect(mocks.file).toHaveBeenCalledOnce();
  expect(mocks.language).not.toHaveBeenCalled();
});

it("starts language loading while IndexedDB is still pending for non-english languages", async () => {
  Object.assign(peekConfig(), { language: "arabic" });
  const file = Promise.withResolvers<undefined>();
  mocks.file.mockReturnValue(file.promise);
  mocks.language.mockResolvedValue({ preferredFont: "Noto_Naskh_Arabic" });
  const applied = applyFontFamily();
  expect(mocks.file).toHaveBeenCalledOnce();
  expect(mocks.language).toHaveBeenCalledWith("arabic");
  file.resolve(undefined);
  await applied;
  expect(getFontFamily()).toContain('"Roboto Mono","Noto Naskh Arabic"');
  expect(getFontFace()).toContain('"Noto Naskh Arabic"');
});

it("ignores an obsolete language/font selection after IO completes", async () => {
  const file = Promise.withResolvers<string>();
  mocks.file.mockReturnValue(file.promise);
  mocks.language.mockResolvedValue({});
  const previous = getFontFamily();
  const applied = applyFontFamily();
  setConfigStore("fontFamily", "Fira_Code");
  file.resolve("data:font/woff2;base64,fixture");
  await applied;
  expect(getFontFamily()).toBe(previous);
});
