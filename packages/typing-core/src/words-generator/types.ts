import { Config, FunboxName } from "@oxytype/schemas/configs";
import { Language, LanguageObject } from "@oxytype/schemas/languages";
import { CustomTextLimitMode, CustomTextMode } from "@oxytype/schemas/util";
import { ActiveFunbox } from ".././active-funboxes";
import { Quote, QuoteWithTextSplit } from ".././quotes";

export type WordsGeneratorConfig = Pick<
  Config,
  | "mode"
  | "words"
  | "language"
  | "punctuation"
  | "numbers"
  | "lazyMode"
  | "britishEnglish"
  | "showAllLines"
  | "quoteLength"
>;
export type CustomTextSource = {
  getText: () => string[];
  getMode: () => CustomTextMode;
  getLimitMode: () => CustomTextLimitMode;
  getLimitValue: () => number;
  getPipeDelimiter: () => boolean;
};
export type QuoteSource = {
  getQuotes: (
    language: Language,
    quoteLengths?: number[],
  ) => Promise<{ length: number }>;
  getQuoteById: (id: number) => Quote | undefined;
  getRandomFavoriteQuote: (language: Language) => Quote | null;
  getRandomQuote: () => Quote | null;
};
export type WordTransforms = {
  replaceAccents: (
    word: string,
    additionalAccents?: LanguageObject["additionalAccents"],
  ) => string;
  britishEnglish: (
    word: string,
    previousWord: string | undefined,
  ) => Promise<string>;
  englishPunctuation: {
    check: (word: string) => Promise<boolean>;
    replace: (word: string) => Promise<string>;
  };
};
export type WordsGeneratorDeps = {
  /** Read on every call, so config changes apply to the next word. */
  getConfig: () => WordsGeneratorConfig;
  getActiveFunboxes: () => ActiveFunbox[];
  customText: CustomTextSource;
  quotes: QuoteSource;
  transforms: WordTransforms;
  isRepeated: () => boolean;
  isPractiseWordsActive: () => boolean;
  getCurrentQuote: () => QuoteWithTextSplit | null;
  setCurrentQuote: (quote: QuoteWithTextSplit | null) => void;
  getSelectedQuoteId: () => number;
  /** Number of words the test currently holds. */
  getWordsLength: () => number;
  setMode: (mode: Config["mode"]) => void;
  setQuoteLengthAll: () => void;
  disableFunbox: (funbox: FunboxName) => void;
  showLoader?: () => void;
  hideLoader?: () => void;
};
export type WordsGenerator = {
  generateWords: (language: LanguageObject) => Promise<GenerateWordsReturn>;
  getNextWord: (
    wordIndex: number,
    wordsBound: number,
    previousWord: string | undefined,
    previousWord2: string | undefined,
  ) => Promise<GetNextWordReturn>;
  appendCommitCharacter: (word: string) => string;
  areAllWordsGenerated: () => boolean;
};
export type GenerateWordsReturn = {
  words: string[];
  sectionIndexes: number[];
  hasTab: boolean;
  hasNewline: boolean;
  allRightToLeft?: boolean;
  allJoiningScript?: boolean;
};
export type GetNextWordReturn = {
  word: string;
  wordRaw: string;
  sectionIndex: number;
};
