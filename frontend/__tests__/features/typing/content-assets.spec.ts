import { afterEach, expect, it, vi } from "vite-plus/test";
import { decodeText } from "@caret/typing-engine/text";
import {
  engineLanguage,
  engineQuotes,
  fetchEngineSource,
} from "../../../src/features/typing/runtime/content-assets.client";
afterEach(() => vi.unstubAllGlobals());

it("keeps raw Unicode words, accents, quote whitespace and language metadata for Rust", () => {
  const language = engineLanguage({
    name: "english",
    words: ["\ud800", "Å… 😀"],
    bcp47: "en",
    originalPunctuation: true,
    additionalAccents: [["å", "a"]],
    rightToLeft: false,
  });
  expect(language.words.map(decodeText)).toEqual(["\ud800", "Å… 😀"]);
  expect(
    language.additionalAccents.map(([a, b]) => [decodeText(a), decodeText(b)]),
  ).toEqual([["å", "a"]]);
  expect(language.originalPunctuation).toBe(true);
  const quotes = engineQuotes({
    language: "english",
    groups: [
      [0, 10],
      [11, 20],
      [21, 30],
      [31, 100],
    ],
    quotes: [{ id: 1, text: "  line…\n next  ", source: "Source", length: 16 }],
  });
  expect(decodeText(quotes.quotes[0]?.text ?? [])).toBe("  line…\n next  ");
  expect(quotes.quotes[0]?.britishText).toBeUndefined();
  expect(quotes.quotes[0]?.textSplit).toEqual([]);
});

it("extracts Wikipedia HTML while leaving citations, typography and Unicode cleanup to Rust", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ title: "Article", pageid: 1 })),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          query: {
            pages: { "1": { extract: "<p>“Å” [1]</p><p> next 😀</p>" } },
          },
        }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const signal = new AbortController().signal;
  const source = await fetchEngineSource(
    { id: 1, generation: 1, kind: "wikipedia", language: "english" },
    { name: "english", words: ["a"], bcp47: "en-US" },
    signal,
  );
  expect(source.kind).toBe("article");
  if (source.kind !== "article") throw new Error("Wrong source");
  expect(decodeText(source.plainText)).toBe("“Å” [1]  next 😀");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0]?.[0]).toBe(
    "https://en.wikipedia.org/api/rest_v1/page/random/summary",
  );
  expect(fetch.mock.calls[1]?.[1]).toEqual({ signal });
});

it("passes the whole raw poem to Rust and aborts before fetching cancelled content", async () => {
  const lines = [
    "_— 😀",
    ...Array.from({ length: 110 }, (_, index) => `word${index}`),
  ];
  const fetch = vi.fn(
    async () =>
      new Response(
        JSON.stringify([{ title: "Poem", author: "Writer", lines }]),
      ),
  );
  vi.stubGlobal("fetch", fetch);
  const controller = new AbortController();
  const request = { id: 1, generation: 1, kind: "poetry", language: "english" };
  const language = { name: "english", words: ["a"] } as const;
  const source = await fetchEngineSource(
    request,
    { ...language, words: [...language.words] },
    controller.signal,
  );
  if (source.kind !== "poem") throw new Error("Wrong source");
  expect(source.lines.map(decodeText)).toEqual(lines);
  controller.abort();
  await expect(
    fetchEngineSource(
      request,
      { ...language, words: [...language.words] },
      controller.signal,
    ),
  ).rejects.toThrow();
  expect(fetch).toHaveBeenCalledOnce();
});
