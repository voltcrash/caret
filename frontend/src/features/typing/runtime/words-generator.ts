import { createWordsGenerator } from "@oxytype/typing-core/words-generator";
import { getMutableConfig } from "../../../ts/config/store";
import {
  setConfig,
  setQuoteLengthAll,
  toggleFunbox,
} from "../../../ts/config/setters";
import * as CustomText from "./custom-text";
import QuotesController from "../../../ts/controllers/quotes-controller";
import * as LazyMode from "@oxytype/typing-core/lazy-mode";
import * as EnglishPunctuation from "@oxytype/typing-core/english-punctuation";
import * as PractiseWords from "./practise-words";
import { getActiveFunboxes } from "./funbox/list";
import { showLoaderBar, hideLoaderBar } from "../../../ts/states/loader-bar";
import {
  getSelectedQuoteId,
  getCurrentQuote,
  isRepeated,
  setCurrentQuote,
} from "../../../ts/states/test";
import * as TestWords from "./test-words";

const generator = createWordsGenerator({
  getConfig: () => getMutableConfig(),
  getActiveFunboxes,
  customText: CustomText,
  quotes: QuotesController,
  transforms: {
    replaceAccents: LazyMode.replaceAccents,
    englishPunctuation: EnglishPunctuation,
    britishEnglish: async (word, previousWord) => {
      const britishEnglish = await import("./british-english");
      return britishEnglish.replace(word, previousWord);
    },
  },
  isRepeated,
  isPractiseWordsActive: () => PractiseWords.before.mode !== null,
  getCurrentQuote,
  setCurrentQuote,
  getSelectedQuoteId,
  getWordsLength: () => TestWords.words.length,
  setMode: (mode) => {
    setConfig("mode", mode);
  },
  setQuoteLengthAll,
  disableFunbox: (name) => {
    toggleFunbox(name);
  },
  showLoader: showLoaderBar,
  hideLoader: hideLoaderBar,
});

export const {
  generateWords,
  getNextWord,
  appendCommitCharacter,
  areAllWordsGenerated,
} = generator;
