import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDefaultConfig } from "../src/config/default-config";
import { createFunboxWords } from "../src/words-generator/funboxes";
import {
  createFunboxWordFunctions,
  getWordFunboxes,
} from "../src/funbox-word-functions";
import type { WordsGeneratorDeps } from "../src/words-generator/types";

const references = [];
for (const kind of ["poetry", "wikipedia"] as const) {
  for (const absent of [false] as const) {
    const config = { ...getDefaultConfig(), funbox: [kind] };
    const recovery: unknown[] = [];
    const functions = createFunboxWordFunctions({
      getConfig: () => config,
      getLanguage: async () => ({ name: "english", words: ["one"] }),
      getPoem: async () => absent,
      getSection: async () => absent,
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
        replaceAccents: (value) => value,
        britishEnglish: async (value) => value,
        englishPunctuation: {
          check: async () => false,
          replace: async (value) => value,
        },
      },
      isRepeated: () => false,
      isPractiseWordsActive: () => false,
      getCurrentQuote: () => null,
      setCurrentQuote: () => undefined,
      getSelectedQuoteId: () => 0,
      getWordsLength: () => 0,
      setMode: () => undefined,
      setQuoteLengthAll: () => undefined,
      disableFunbox: (name) =>
        recovery.push({ op: "disableFunbox", name, noRestart: false }),
    };
    let message: string | undefined;
    try {
      await createFunboxWords(deps).getFunboxSection();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      message = error.message;
    }
    if (message === undefined) {
      throw new Error("Expected initial section failure");
    }
    references.push({
      kind,
      absent: "false",
      expected: { message, recovery },
    });
  }
}
writeFileSync(
  resolve(
    import.meta.dirname,
    "../../typing-fixtures/oracle/source-recovery.json",
  ),
  `${JSON.stringify(references, null, 2)}\n`,
  { flag: "wx" },
);
