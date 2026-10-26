import { describe, it, expect, vi, Mock } from "vite-plus/test";
import { LanguageObject } from "@caret/schemas/languages";
import {
  createLanguageLoader,
  FetchJson,
  memoizeAsync,
} from "../src/languages";

const english = {
  name: "english",
  words: ["a", "b"],
  orderedByFrequency: true,
} as LanguageObject;
const french = { name: "french", words: ["c"] } as unknown as LanguageObject;

function fakeFetch(): Mock<FetchJson> {
  return vi.fn<FetchJson>(async (url) =>
    url.includes("french") ? french : english,
  );
}

describe("memoizeAsync", () => {
  it("shares concurrent requests and evicts the least recently used entry", async () => {
    const fn = vi.fn(async (key: string) => key);
    const memoized = memoizeAsync(fn, undefined, { maxEntries: 2 });
    await Promise.all([memoized("a"), memoized("a")]);
    await memoized("b");
    await memoized("a");
    await memoized("c");
    await memoized("a");
    expect(fn).toHaveBeenCalledTimes(3);
    await memoized("b");
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("retries failures without removing a replacement request", async () => {
    let rejectFirst!: (error: Error) => void;
    const fn = vi.fn(async (key: string) => key);
    fn.mockImplementationOnce(
      async () =>
        new Promise<string>((_resolve, reject) => {
          rejectFirst = reject;
        }),
    );
    const memoized = memoizeAsync(fn, undefined, { maxEntries: 1 });
    const first = memoized("a");
    const failed = expect(first).rejects.toThrow("failed");
    await memoized("b");
    await memoized("a");
    rejectFirst(new Error("failed"));
    await failed;
    await memoized("a");
    expect(fn).toHaveBeenCalledTimes(3);

    fn.mockRejectedValueOnce(new Error("retry"));
    await expect(memoized("c")).rejects.toThrow("retry");
    expect(await memoized("c")).toBe("c");
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it("calls the function once per key", async () => {
    const fn = vi.fn(async (n: number) => n * 2);
    const memoized = memoizeAsync(fn);
    expect(await memoized(2)).toBe(4);
    expect(await memoized(2)).toBe(4);
    expect(await memoized(3)).toBe(6);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("createLanguageLoader", () => {
  it("reloads evicted languages", async () => {
    const fetchJson = fakeFetch();
    const loader = createLanguageLoader({ fetchJson, maxEntries: 1 });
    await loader.getLanguage("english");
    await loader.getLanguage("french");
    expect(await loader.getLanguage("english")).toBe(english);
    expect(fetchJson).toHaveBeenCalledTimes(3);
  });

  it("loads from the default url", async () => {
    const fetchJson = fakeFetch();
    const loader = createLanguageLoader({ fetchJson });
    expect(await loader.getLanguage("english")).toBe(english);
    expect(fetchJson).toHaveBeenCalledWith("/languages/english.json");
  });

  it("caches languages", async () => {
    const fetchJson = fakeFetch();
    const loader = createLanguageLoader({
      fetchJson,
      getUrl: (lang) => `cache/${lang}`,
    });
    await loader.getLanguage("english");
    await loader.getLanguage("french");
    await loader.getLanguage("english");
    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(fetchJson).toHaveBeenCalledWith("cache/french");
  });

  it("rejects languages that fail verification", async () => {
    const loader = createLanguageLoader({
      fetchJson: fakeFetch(),
      verify: async () => {
        throw new Error("Integrity check failed");
      },
    });
    await expect(loader.getLanguage("english")).rejects.toThrow(
      "Integrity check failed",
    );
  });

  it("reports zipf support", async () => {
    const loader = createLanguageLoader({ fetchJson: fakeFetch() });
    expect(await loader.checkIfLanguageSupportsZipf("english")).toBe("yes");
    expect(await loader.checkIfLanguageSupportsZipf("french")).toBe("unknown");
  });
});
