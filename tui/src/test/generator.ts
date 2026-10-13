import type { Config } from "@oxytype/schemas/configs";
import type { CustomTextSettings } from "@oxytype/schemas/results";
import * as BritishEnglish from "@oxytype/typing-core/british-english";
import * as EnglishPunctuation from "@oxytype/typing-core/english-punctuation";
import { replaceAccents } from "@oxytype/typing-core/lazy-mode";
import type { QuoteWithTextSplit } from "@oxytype/typing-core/quotes";
import type {
  CustomTextSource,
  WordsGenerator,
} from "@oxytype/typing-core/words-generator";
import { createWordsGenerator } from "@oxytype/typing-core/words-generator";

import {
  createFunboxWordFunctions,
  getWordFunboxes,
} from "@oxytype/typing-core/funbox-word-functions";
import type { Wordset } from "@oxytype/typing-core/wordset";
import type { ConfigStore } from "../config/store";
import type { TestSources } from "./sources";

export type GeneratorOptions = {
  store: ConfigStore;
  isPractice: () => boolean;
  getWeakSpotWord: (wordset: Wordset) => string;
  notify: (message: string) => void;
  getSelectedQuoteId?: () => number;
  /** The config words are generated for, e.g. with a fallback language. */
  getConfig: () => Config;
  sources: TestSources;
  customText: CustomTextSettings;
  getWordsLength: () => number;
  isRepeated: () => boolean;
  getCurrentQuote: () => QuoteWithTextSplit | null;
  setCurrentQuote: (quote: QuoteWithTextSplit | null) => void;
};

function customTextSource(settings: CustomTextSettings): CustomTextSource {
  return {
    getText: () => settings.text,
    getMode: () => settings.mode,
    getLimitMode: () => settings.limit.mode,
    getLimitValue: () => settings.limit.value,
    getPipeDelimiter: () => settings.pipeDelimiter,
  };
}

export function createGenerator(options: GeneratorOptions): WordsGenerator {
  const { store } = options;
  const functions = createFunboxWordFunctions({
    getConfig: options.getConfig,
    getLanguage: async (language) => {
      const loaded = await options.sources.loadLanguage(language);
      if (loaded.missing !== undefined) {
        throw new Error(`${language} unavailable offline`);
      }
      return loaded.language;
    },
    getPoem: options.sources.getPoem,
    getSection: options.sources.getSection,
    getWeakSpotWord: options.getWeakSpotWord,
    notify: options.notify,
    disableFunbox: (name) =>
      store.set(
        "funbox",
        store.config.funbox.filter((it) => it !== name),
      ),
    setLanguage: (language) => store.set("language", language),
  });
  return createWordsGenerator({
    getConfig: options.getConfig,
    getActiveFunboxes: () =>
      getWordFunboxes(options.getConfig().funbox, functions),
    customText: customTextSource(options.customText),
    quotes: options.sources.quotes,
    transforms: {
      replaceAccents,
      englishPunctuation: EnglishPunctuation,
      britishEnglish: async (word, previous) =>
        BritishEnglish.replace(word, previous, options.getConfig().mode),
    },
    isRepeated: options.isRepeated,
    isPractiseWordsActive: options.isPractice,
    getCurrentQuote: options.getCurrentQuote,
    setCurrentQuote: options.setCurrentQuote,
    getSelectedQuoteId: options.getSelectedQuoteId ?? (() => 1),
    getWordsLength: options.getWordsLength,
    setMode: (mode) => store.set("mode", mode),
    setQuoteLengthAll: () => store.set("quoteLength", [0, 1, 2, 3]),
    disableFunbox: (name) =>
      store.set(
        "funbox",
        store.config.funbox.filter((it) => it !== name),
      ),
  });
}
