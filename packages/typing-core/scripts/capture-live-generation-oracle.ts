import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "@oxytype/schemas/configs";
import type { WordsGeneratorDeps } from "../src/words-generator/types";
const units = (text: string): number[] =>
  Array.from({ length: text.length }, (_, index) => text.charCodeAt(index));
const original = Math.random;
let state = 91;
Math.random = () => {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
try {
  const { createWordsGenerator } = await import("../src/words-generator");
  const { getDefaultConfig } = await import("../src/config/default-config");
  const { createFunboxWordFunctions, getWordFunboxes } =
    await import("../src/funbox-word-functions");
  const lazy = await import("../src/lazy-mode");
  const british = await import("../src/british-english");
  const english = await import("../src/english-punctuation");
  const config: Config = { ...getDefaultConfig(), mode: "time", time: 0 };
  const initial = { ...config };
  const language = {
    name: "english" as const,
    words: ["colour", "café", "résumé", "naïve"],
  };
  let words: string[] = [];
  const functions = createFunboxWordFunctions({
    getConfig: () => config,
    getLanguage: async () => language,
    getPoem: async () => false,
    getSection: async () => false,
    disableFunbox: () => undefined,
    setLanguage: () => undefined,
  });
  const deps: WordsGeneratorDeps = {
    getConfig: () => config,
    getActiveFunboxes: () => getWordFunboxes(config.funbox, functions),
    customText: {
      getText: () => [],
      getMode: () => "repeat",
      getLimitMode: () => "word",
      getLimitValue: () => 0,
      getPipeDelimiter: () => false,
    },
    quotes: {
      getQuotes: async () => ({ length: 0 }),
      getQuoteById: () => undefined,
      getRandomFavoriteQuote: () => null,
      getRandomQuote: () => null,
    },
    transforms: {
      replaceAccents: lazy.replaceAccents,
      britishEnglish: async (word, previous) =>
        british.replace(word, previous, config.mode),
      englishPunctuation: english,
    },
    isRepeated: () => false,
    isPractiseWordsActive: () => false,
    getCurrentQuote: () => null,
    setCurrentQuote: () => undefined,
    getSelectedQuoteId: () => 0,
    getWordsLength: () => words.length,
    setMode: () => undefined,
    setQuoteLengthAll: () => undefined,
    disableFunbox: () => undefined,
  };
  const generator = createWordsGenerator(deps);
  const generated = await generator.generateWords(language);
  words = [...generated.words];
  const steps = [];
  for (const patch of [
    { punctuation: true },
    { numbers: true },
    { lazyMode: true },
    { britishEnglish: true },
    { funbox: ["underscore_spaces", "ALL_CAPS"] },
    {
      funbox: [],
      punctuation: false,
      numbers: false,
      lazyMode: false,
      britishEnglish: false,
    },
  ] as Partial<Config>[]) {
    Object.assign(config, patch);
    const extra = [];
    for (let index = 0; index < 5; index++) {
      const next = await generator.getNextWord(
        words.length,
        100,
        words.at(-1)?.replace(/[ \n]$/, ""),
        words.at(-2)?.replace(/[ \n]$/, ""),
      );
      words.push(next.word);
      extra.push({
        ...next,
        word: units(next.word),
        wordRaw: units(next.wordRaw),
      });
    }
    steps.push({ config: structuredClone(config), extra });
  }
  writeFileSync(
    resolve(
      import.meta.dirname,
      "../../typing-fixtures/oracle/live-generation.json",
    ),
    `${JSON.stringify({ input: { config: initial, language: { ...language, words: language.words.map(units) }, random: { kind: "seeded", state: 91 } }, generated: { ...generated, words: generated.words.map(units) }, steps, randomTail: Math.random() }, null, 2)}\n`,
    { flag: "wx" },
  );
} finally {
  Math.random = original;
}
