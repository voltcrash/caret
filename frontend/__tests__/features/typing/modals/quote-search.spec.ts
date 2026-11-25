import { describe, expect, it } from "vite-plus/test";

import { buildQuoteSearchIndex } from "../../../../src/features/typing/modals/quote-search";
import type { Quote } from "../../../../src/features/typing/runtime/quotes-controller";

function makeQuote(
  overrides: Partial<Quote> & Pick<Quote, "id" | "text" | "source">,
): Quote {
  return {
    length: overrides.text.length,
    group: 0,
    language: "english",
    ...overrides,
  };
}

describe("quote search index", () => {
  const quotes: Quote[] = [
    makeQuote({
      id: 1,
      text: "You have the power to heal your life, and you need to know that.",
      source: "Meditations to Heal Your Life",
    }),
    makeQuote({
      id: 42,
      text: "The quick brown fox jumps over the lazy dog.",
      source: "English Pangram",
    }),
    makeQuote({
      id: 99,
      text: "Quicker than shadows, a philosopher reflects on Shakespeare and fate.",
      source: "Modern Essay",
    }),
    makeQuote({
      id: 105,
      text: "All the world is a stage and all the men and women merely players.",
      source: "William Shakespeare - As You Like It",
    }),
    makeQuote({
      id: 200,
      text: "He read forty-two pages, including page 42 twice.",
      source: "Numbered Notes",
    }),
  ];

  it("matches exact words and deduplicates repeated query terms", () => {
    const index = buildQuoteSearchIndex(quotes);

    expect(index.query("fox").results.map((q) => q.id)).toEqual([42]);
    expect(index.query("fox fox").results).toEqual(index.query("fox").results);
    expect(index.query("brown").matchedQueryTerms).toEqual(["brown"]);
    expect(index.query("brown").matchedTermsById.get(42)).toEqual(["brown"]);
  });

  it("boosts source/author and id matches above passing mentions in text", () => {
    const index = buildQuoteSearchIndex(quotes);

    expect(index.query("Shakespeare").results.map((q) => q.id)).toEqual([
      105, 99,
    ]);
    expect(index.query("42").results[0]?.id).toBe(42);
  });

  it("supports prefix matching and ranks exact matches ahead of prefixes", () => {
    const index = buildQuoteSearchIndex(quotes);

    expect(index.query("medit").results.map((q) => q.id)).toEqual([1]);
    expect(index.query("shake").results.map((q) => q.id)).toEqual([105, 99]);
    expect(index.query("quick").results.map((q) => q.id)).toEqual([42, 99]);
  });

  it("tolerates typos without fuzzing short words or numeric IDs", () => {
    const index = buildQuoteSearchIndex(quotes);

    expect(index.query("shakespear").results[0]?.id).toBe(105);
    expect(index.query("meditaton").results.map((q) => q.id)).toEqual([1]);
    expect(index.query("philosohpy").results.map((q) => q.id)).toEqual([]);
    expect(index.query("philosohper").results.map((q) => q.id)).toEqual([99]);

    // Short words (< 4 chars) and numeric IDs must not fuzzy-match neighbors.
    expect(index.query("foy").results).toEqual([]);
    expect(index.query("106").results).toEqual([]);
  });

  it("preserves original casing and accents in matched terms for highlighting", () => {
    const index = buildQuoteSearchIndex(quotes);
    const result = index.query("meditations");

    expect(result.results.map((q) => q.id)).toEqual([1]);
    expect(result.matchedQueryTerms).toEqual(["Meditations"]);
    expect(result.matchedTermsById.get(1)).toEqual(["Meditations"]);
  });

  it("filters results by allowed external quote IDs", () => {
    const index = buildQuoteSearchIndex(quotes);

    expect(index.query("quick", [99]).results.map((q) => q.id)).toEqual([99]);
    expect(index.query("quick", [1]).results).toEqual([]);
    expect(index.query("!!!").results).toEqual([]);
    expect(buildQuoteSearchIndex([]).query("fox")).toEqual({
      results: [],
      matchedQueryTerms: [],
      matchedTermsById: new Map(),
    });
  });

  it("handles Object prototype property names safely", () => {
    const protoQuotes = [
      makeQuote({
        id: 1,
        text: "constructor fox fox",
        source: "src",
      }),
      makeQuote({
        id: 2,
        text: "constructor constructor fox",
        source: "src",
      }),
      makeQuote({
        id: 3,
        text: "toString valueOf",
        source: "src",
      }),
    ];
    const index = buildQuoteSearchIndex(protoQuotes);

    expect(index.query("constructor").results.map((q) => q.id)).toEqual([2, 1]);
    expect(index.query("toString").results.map((q) => q.id)).toEqual([3]);
  });

  it("handles non-English quotes without English stemming corruption", () => {
    const multilingualQuotes: Quote[] = [
      makeQuote({
        id: 1,
        language: "french",
        text: "Si j'avais su t'aimer, avec des petits déjeuners et un café chaud.",
        source: "Chimène Badi",
      }),
      makeQuote({
        id: 2,
        language: "russian",
        text: "Старик благодушно улыбался и кивал головой.",
        source: "А. П. Чехов - Верочка.",
      }),
      makeQuote({
        id: 3,
        language: "arabic",
        text: "عاشر وخالط الذين يهتمون بأوقاتهم كي تصيبك العدوى.",
        source: "إبراهيم الفقي، إدارة الوقت",
      }),
      makeQuote({
        id: 4,
        language: "hindi",
        text: "कहाँ पता था कि जब तैरना सीख जाएंगे तो नदी से ही दूर हो जाएंगे।",
        source: "पंकज त्रिपाठी",
      }),
      makeQuote({
        id: 5,
        language: "chinese_simplified",
        text: "三人行，必有我师焉，择其善者而从之。",
        source: "孔子",
      }),
    ];
    const index = buildQuoteSearchIndex(multilingualQuotes);

    // French diacritic folding + original accent preserved for highlight
    const french = index.query("dejeuners cafe");
    expect(french.results.map((q) => q.id)).toEqual([1]);
    expect(french.matchedTermsById.get(1)).toEqual(
      expect.arrayContaining(["déjeuners", "café"]),
    );

    // Russian case-folding + prefix
    expect(index.query("чех").results.map((q) => q.id)).toEqual([2]);
    expect(index.query("старик").matchedTermsById.get(2)).toEqual(["Старик"]);

    // Arabic exact & prefix
    expect(index.query("إبراهيم").results.map((q) => q.id)).toEqual([3]);
    expect(index.query("يهتم").results.map((q) => q.id)).toEqual([3]);

    // Hindi combining marks preserved (vowel signs not stripped)
    expect(index.query("तैरना").results.map((q) => q.id)).toEqual([4]);
    expect(index.query("त्रिपाठी").results.map((q) => q.id)).toEqual([4]);

    // Chinese single-character source prefix & multi-character prefix
    expect(index.query("孔").results.map((q) => q.id)).toEqual([5]);
    expect(index.query("三人").results.map((q) => q.id)).toEqual([5]);
  });
});
