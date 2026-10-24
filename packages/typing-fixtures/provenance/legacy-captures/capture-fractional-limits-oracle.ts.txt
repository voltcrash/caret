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
  const { createFunboxWordFunctions, getWordFunboxes } =
    await import("../src/funbox-word-functions");
  const { getDefaultConfig } = await import("../src/config/default-config");
  const refs = [];
  for (const mode of ["word", "section", "time"] as const) {
    for (const value of [0.5, 1.5, 100.5]) {
      for (const funbox of [
        [],
        ["plus_three"],
        ["underscore_spaces"],
      ] as const) {
        state = 91;
        const config: Config = {
          ...getDefaultConfig(),
          mode: "custom",
          showAllLines: true,
          funbox: [...funbox],
        };
        const text =
          mode === "section"
            ? ["one two", "three four", "five six"]
            : ["one", "two", "three"];
        const language = { name: "english" as const, words: ["base"] };
        const custom = {
          text: text.map(units),
          mode: "repeat",
          limit: { mode, value },
          pipeDelimiter: mode === "section",
        };
        const functions = createFunboxWordFunctions({
          getConfig: () => config,
          getLanguage: async () => language,
          getPoem: async () => false,
          getSection: async () => false,
          disableFunbox: () => undefined,
          setLanguage: () => undefined,
        });
        let generatedWords: string[] = [];
        const deps: WordsGeneratorDeps = {
          getConfig: () => config,
          getActiveFunboxes: () => getWordFunboxes(config.funbox, functions),
          customText: {
            getText: () => text,
            getMode: () => "repeat",
            getLimitMode: () => mode,
            getLimitValue: () => value,
            getPipeDelimiter: () => mode === "section",
          },
          quotes: {
            getQuotes: async () => ({ length: 0 }),
            getQuoteById: () => undefined,
            getRandomFavoriteQuote: () => null,
            getRandomQuote: () => null,
          },
          transforms: {
            replaceAccents: (word) => word,
            britishEnglish: async (word) => word,
            englishPunctuation: {
              check: async () => false,
              replace: async (word) => word,
            },
          },
          isRepeated: () => false,
          isPractiseWordsActive: () => false,
          getCurrentQuote: () => null,
          setCurrentQuote: () => undefined,
          getSelectedQuoteId: () => 0,
          getWordsLength: () => generatedWords.length,
          setMode: () => undefined,
          setQuoteLengthAll: () => undefined,
          disableFunbox: () => undefined,
        };
        const generator = createWordsGenerator(deps);
        const result = await generator.generateWords(language);
        generatedWords = result.words;
        refs.push({
          name: `${mode}-${value}-${funbox.join("+")}`,
          input: {
            config,
            language: { ...language, words: language.words.map(units) },
            custom,
            random: { kind: "seeded", state: 91 },
          },
          expected: { ...result, words: result.words.map(units) },
          allGenerated: generator.areAllWordsGenerated(),
          randomTail: Math.random(),
        });
      }
    }
  }
  writeFileSync(
    resolve(
      import.meta.dirname,
      "../../typing-fixtures/oracle/fractional-limits-v2.json",
    ),
    `${JSON.stringify(refs, null, 2)}\n`,
    { flag: "wx" },
  );
} finally {
  Math.random = original;
}
