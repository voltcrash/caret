import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { QuotesController } from "../src/quote-source";
import { getQuoteWordList } from "../src/words-generator/quotes";
import type { WordsGeneratorDeps } from "../src/words-generator/types";
import type { QuoteWithTextSplit } from "../src/quotes";
const asset = {
  language: "german",
  groups: [
    [0, 100],
    [101, 200],
    [201, 300],
    [301, 999],
  ],
  quotes: [
    {
      id: 1,
      text: "  one…\n line  ",
      britishText: "colour centre",
      length: 12,
      source: "fixture",
    },
  ],
};
const quotes = new QuotesController({
  fetchJson: async () => asset,
  getSnapshot: () => null,
});
let britishEnglish = false;
let currentQuote: QuoteWithTextSplit | null = null;
const deps: WordsGeneratorDeps = {
  getConfig: () => ({
    mode: "quote",
    words: 10,
    language: "swiss_german",
    punctuation: false,
    numbers: false,
    lazyMode: false,
    britishEnglish,
    showAllLines: false,
    quoteLength: [-2],
  }),
  quotes,
  getSelectedQuoteId: () => 1,
  isRepeated: () => false,
  getCurrentQuote: () => currentQuote,
  setCurrentQuote: (value) => {
    currentQuote = value;
  },
  getActiveFunboxes: () => [],
  customText: {
    getText: () => [],
    getMode: () => "repeat",
    getLimitMode: () => "word",
    getLimitValue: () => 1,
    getPipeDelimiter: () => false,
  },
  transforms: {
    replaceAccents: (word) => word,
    britishEnglish: async (word) => word,
    englishPunctuation: {
      check: async () => false,
      replace: async (word) => word,
    },
  },
  isPractiseWordsActive: () => false,
  getWordsLength: () => 0,
  setMode: () => undefined,
  setQuoteLengthAll: () => undefined,
  disableFunbox: () => undefined,
};
const stages = [];
for (const british of [false, true]) {
  britishEnglish = british;
  const words = await getQuoteWordList(
    deps,
    { name: "swiss_german", words: [] },
    null,
    null,
  );
  stages.push({
    british,
    expected: structuredClone({
      words,
      currentQuote,
      collection: await quotes.getQuotes("german"),
    }),
  });
}
writeFileSync(
  resolve(
    import.meta.dirname,
    "../../typing-fixtures/oracle/quote-catalog-selection.json",
  ),
  `${JSON.stringify({ asset, stages }, null, 2)}\n`,
  { flag: "wx" },
);
