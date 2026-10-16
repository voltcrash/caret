import { afterEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("../../src/ts/utils/json-data", () => ({
  getLanguage: vi.fn(),
  Section: class {
    title: string;
    author: string;
    words: string[];
    constructor(title: string, author: string, words: string[]) {
      this.title = title;
      this.author = author;
      this.words = words;
    }
  },
}));
vi.mock("../../src/ts/states/loader-bar", () => ({
  showLoaderBar: vi.fn(),
  hideLoaderBar: vi.fn(),
}));

import { getLanguage } from "../../src/ts/utils/json-data";
import { getSection } from "../../src/features/typing/runtime/wikipedia";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Wikipedia extract parsing", () => {
  it.each([
    [
      "en",
      "<p>‘Fish’ &amp; <b>chips</b>[12].</p><p>Next\u200b — café.</p>",
      ["'Fish'", "&", "chips.", "Next", "-", "caf."],
    ],
    [
      "fr",
      "<p>Été &amp; <a href='/x'>hiver</a>.</p><p>Après [1] demain.</p>",
      ["Été", "&", "hiver.", "Après", "demain."],
    ],
  ])("preserves extracted text for %s", async (bcp47, extract, words) => {
    vi.mocked(getLanguage).mockResolvedValue({ bcp47 } as Awaited<
      ReturnType<typeof getLanguage>
    >);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({
          title: "Article",
          author: "Author",
          pageid: 12,
        }),
      }),
    );
    vi.stubGlobal(
      "XMLHttpRequest",
      class {
        readyState = 4;
        status = 200;
        responseText = JSON.stringify({
          query: { pages: { "12": { extract } } },
        });
        onload?: () => void;
        open(): void {
          /* Network transport is stubbed. */
        }
        send(): void {
          this.onload?.();
        }
      },
    );
    expect(await getSection("english")).toEqual({
      title: "Article",
      author: "Author",
      words,
    });
  });
});
