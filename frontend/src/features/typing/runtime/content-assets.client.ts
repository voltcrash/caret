import { z } from "zod";
import type { LanguageObject } from "@caret/schemas/languages";
import type { QuoteData } from "@caret/schemas/quotes";
import type {
  Prepare,
  Source,
  ContentRequest,
} from "@caret/typing-engine/browser.client";
import { encodeText } from "@caret/typing-engine/text";

/** Mechanical asset conversion; text cleanup, grouping and transforms stay in Rust. */
export function engineLanguage(input: LanguageObject): Prepare["language"] {
  return {
    name: input.name,
    bcp47: input.bcp47 ?? null,
    words: input.words.map(encodeText),
    rightToLeft: input.rightToLeft ?? null,
    joiningScript: input.joiningScript ?? false,
    originalPunctuation: input.originalPunctuation ?? false,
    noLazyMode: input.noLazyMode ?? false,
    additionalAccents: (input.additionalAccents ?? []).map(([a, b]) => [
      encodeText(a),
      encodeText(b),
    ]),
  };
}
export function engineQuotes(input: QuoteData): NonNullable<Prepare["quotes"]> {
  return {
    language: input.language,
    groups: input.groups,
    quotes: input.quotes.map((quote) => ({
      id: quote.id,
      text: encodeText(quote.text),
      ...(quote.britishText === undefined
        ? {}
        : { britishText: encodeText(quote.britishText) }),
      source: quote.source,
      length: quote.length,
      group: 0,
      language: input.language,
      textSplit: [],
    })),
  };
}
const poemSchema = z
  .array(
    z.object({
      title: z.string(),
      author: z.string(),
      lines: z.array(z.string()),
    }),
  )
  .min(1);
const articleSchema = z.object({
  title: z.string(),
  author: z.string().optional(),
  pageid: z.number().int().nonnegative(),
});
const extractSchema = z.object({
  query: z.object({
    pages: z.record(z.string(), z.object({ extract: z.string() })),
  }),
});
async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Content request failed: ${response.status}`);
  }
  return response.json();
}
/** Fetch one raw source. Rust decides whether cleaned content is empty/retryable. */
export async function fetchEngineSource(
  request: ContentRequest,
  language: LanguageObject,
  signal: AbortSignal,
): Promise<Source> {
  signal.throwIfAborted();
  if (request.kind === "poetry") {
    const poem = poemSchema.parse(
      await fetchJson("https://poetrydb.org/random", signal),
    )[0];
    if (poem === undefined) throw new Error("Poem not found");
    return {
      kind: "poem",
      title: encodeText(poem.title),
      author: encodeText(poem.author),
      lines: poem.lines.map(encodeText),
    };
  }
  if (request.kind !== "wikipedia") {
    throw new Error(`Unknown content source: ${request.kind}`);
  }
  const tld = language.bcp47?.split("-")[0] ?? "en";
  const article = articleSchema.parse(
    await fetchJson(
      `https://${tld}.wikipedia.org/api/rest_v1/page/random/summary`,
      signal,
    ),
  );
  const data = extractSchema.parse(
    await fetchJson(
      `https://${tld}.wikipedia.org/w/api.php?action=query&format=json&pageids=${article.pageid}&prop=extracts&exintro=true&origin=*`,
      signal,
    ),
  );
  const page = data.query.pages[`${article.pageid}`];
  if (page === undefined) throw new Error("Page not found");
  // Keep paragraph separation identical to the existing browser HTML adapter.
  const plainText =
    new DOMParser().parseFromString(
      `<body>${page.extract.replace(/<\/p><p>+/g, " ")}</body>`,
      "text/html",
    ).body.textContent ?? "";
  signal.throwIfAborted();
  return {
    kind: "article",
    title: encodeText(article.title),
    author: article.author === undefined ? null : encodeText(article.author),
    plainText: encodeText(plainText),
  };
}
