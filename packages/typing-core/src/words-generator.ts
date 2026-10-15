import { getGenerationLimit } from "./words-generator/limits";
import { createWordTransforms } from "./words-generator/transforms";
import { createFunboxWords } from "./words-generator/funboxes";
import { createPunctuation } from "./words-generator/punctuation";
import type {
  WordsGeneratorConfig,
  WordsGeneratorDeps,
  WordsGenerator,
  GenerateWordsReturn,
  GetNextWordReturn,
} from "./words-generator/types";
import { LanguageObject } from "@oxytype/schemas/languages";
import {
  findSingleFunboxWithFunction,
  getFunboxesWithFunction,
} from "./active-funboxes";
import * as Arrays from "./arrays";
import { WordGenError } from "./errors";
import { FunboxWordOrder } from "./languages";
import { Quote, QuoteWithTextSplit } from "./quotes";
import * as Strings from "./strings";
import { PolyglotWordset, Wordset, withWords } from "./wordset";

//pin implementation
const random = Math.random;

export function createWordsGenerator(deps: WordsGeneratorDeps): WordsGenerator {
  const config = (): WordsGeneratorConfig => deps.getConfig();

  const { applyBritishEnglishToWord, applyLazyModeToWord, applyNumbersToWord } =
    createWordTransforms(deps, () => currentWordset, random);
  const punctuateWord = createPunctuation(deps, random);
  const {
    getFunboxWordsFrequency,
    getFunboxSection,
    getFunboxWord,
    applyFunboxesToWord,
    getWordOrder,
    appendCommitCharacter,
  } = createFunboxWords(deps);

  async function getQuoteWordList(
    language: LanguageObject,
    wordOrder?: FunboxWordOrder,
  ): Promise<string[]> {
    if (deps.isRepeated()) {
      if (currentWordset === null) {
        throw new WordGenError("Current wordset is null");
      }

      deps.setCurrentQuote(previousRandomQuote);

      // need to re-reverse the words if the test is repeated
      // because it will be reversed again in the generateWords function
      if (wordOrder === "reverse") {
        return currentWordset.words.reverse();
      } else {
        return currentWordset.words;
      }
    }
    const languageToGet = language.name.startsWith("swiss_german")
      ? "german"
      : language.name;

    deps.showLoader?.();
    const quotesCollection = await deps.quotes.getQuotes(
      languageToGet,
      config().quoteLength,
    );
    deps.hideLoader?.();

    if (quotesCollection.length === 0) {
      deps.setMode("words");
      throw new WordGenError(
        `No ${config()
          .language.replace(/_\d*k$/g, "")
          .replace(/_/g, " ")} quotes found`,
      );
    }

    let rq: Quote;
    if (
      config().quoteLength.includes(-2) &&
      config().quoteLength.length === 1
    ) {
      const targetQuote = deps.quotes.getQuoteById(deps.getSelectedQuoteId());
      if (targetQuote === undefined) {
        deps.setQuoteLengthAll();
        throw new WordGenError(
          `Quote ${deps.getSelectedQuoteId()} does not exist`,
        );
      }
      rq = targetQuote;
    } else if (config().quoteLength.includes(-3)) {
      const randomQuote = deps.quotes.getRandomFavoriteQuote(config().language);
      if (randomQuote === null) {
        deps.setQuoteLengthAll();
        throw new WordGenError("No favorite quotes found");
      }
      rq = randomQuote;
    } else {
      const randomQuote = deps.quotes.getRandomQuote();
      if (randomQuote === null) {
        deps.setQuoteLengthAll();
        throw new WordGenError("No quotes found for selected quote length");
      }
      rq = randomQuote;
    }

    rq.language = Strings.removeLanguageSize(config().language);
    rq.text = rq.text.replace(/ +/gm, " ");
    rq.text = rq.text.replace(/( *(\r\n|\r|\n) *)/g, "\n ");
    rq.text = rq.text.replace(/…/g, "...");
    rq.text = rq.text.trim();

    if (
      rq.britishText !== undefined &&
      rq.britishText !== "" &&
      config().britishEnglish
    ) {
      rq.textSplit = rq.britishText.split(" ");
    } else {
      rq.textSplit = rq.text.split(" ");
    }

    deps.setCurrentQuote(rq as QuoteWithTextSplit);

    const currentQuote = deps.getCurrentQuote();
    if (currentQuote === null) {
      throw new WordGenError("Random quote is null");
    }

    if (currentQuote.textSplit === undefined) {
      throw new WordGenError("Random quote textSplit is undefined");
    }

    return currentQuote.textSplit;
  }

  let currentWordset: Wordset | null = null;
  let currentLanguage: LanguageObject | null = null;
  let isCurrentlyUsingFunboxSection = false;

  let previousRandomQuote: QuoteWithTextSplit | null = null;

  async function generateWords(
    language: LanguageObject,
  ): Promise<GenerateWordsReturn> {
    if (!deps.isRepeated()) {
      previousGetNextWordReturns = [];
    }
    previousRandomQuote = deps.getCurrentQuote();
    deps.setCurrentQuote(null);
    currentSection = [];
    sectionIndex = 0;
    sectionHistory = [];
    currentLanguage = language;
    const rawWordList: string[] = [];
    const ret: GenerateWordsReturn = {
      words: [],
      sectionIndexes: [],
      hasTab: false,
      hasNewline: false,
      allRightToLeft: language.rightToLeft,
      allJoiningScript: language.joiningScript ?? false,
    };

    isCurrentlyUsingFunboxSection =
      getFunboxesWithFunction(deps.getActiveFunboxes(), "pullSection").length >
      0;

    const wordOrder = getWordOrder();

    let wordList = language.words;
    if (config().mode === "custom") {
      wordList = deps.customText.getText();
    } else if (config().mode === "quote") {
      wordList = await getQuoteWordList(language, wordOrder);
    } else if (config().mode === "zen") {
      wordList = [];
    }

    const customAndUsingPipeDelimiter =
      config().mode === "custom" && deps.customText.getPipeDelimiter();

    const limit = getGenerationLimit(deps);

    if (wordOrder === "reverse") {
      wordList = wordList.reverse();
    }

    const funbox = findSingleFunboxWithFunction(
      deps.getActiveFunboxes(),
      "withWords",
    );
    if (funbox) {
      const result = await funbox.functions.withWords(wordList);
      // PolyglotWordset if polyglot otherwise Wordset
      if (result instanceof PolyglotWordset) {
        const polyglotResult = result;
        currentWordset = polyglotResult;
        // set allJoiningScript if any language in languageProperties has joiningScript: true
        ret.allJoiningScript = Array.from(
          polyglotResult.languageProperties.values(),
        ).some((props) => !!props.joiningScript);
      } else {
        currentWordset = result;
      }
    } else {
      currentWordset = await withWords(wordList);
    }

    if (limit === 0) {
      return ret;
    }

    let stop = false;
    let i = 0;
    while (!stop) {
      const nextWord = await getNextWord(
        i,
        limit,
        Arrays.nthElementFromArray(rawWordList, -1) ?? "",
        Arrays.nthElementFromArray(rawWordList, -2) ?? "",
      );
      rawWordList.push(nextWord.wordRaw);
      ret.words.push(nextWord.word);
      ret.sectionIndexes.push(nextWord.sectionIndex);

      if (customAndUsingPipeDelimiter) {
        //generate a given number of sections, make sure to not cut a section off
        const sectionFinishedAndOverLimit =
          currentSection.length === 0 && sectionIndex >= limit;
        //make sure we dont go over a hard limit, in cases where the sections are very large
        const upperWordLimit = ret.words.length >= 100;
        if (sectionFinishedAndOverLimit || upperWordLimit) {
          stop = true;
        }
      } else if (ret.words.length >= limit) {
        stop = true;
      }
      i++;
    }

    const quote = deps.getCurrentQuote();

    if (config().mode === "quote" && quote === null) {
      throw new WordGenError("Random quote is null");
    }

    ret.hasTab =
      ret.words.some((w) => w.includes("\t")) ||
      currentWordset.words.some((w) => w.includes("\t")) ||
      (config().mode === "quote" &&
        (quote as QuoteWithTextSplit).textSplit.some((w) => w.includes("\t")));
    ret.hasNewline =
      ret.words.some((w) => w.includes("\n")) ||
      currentWordset.words.some((w) => w.includes("\n")) ||
      (config().mode === "quote" &&
        (quote as QuoteWithTextSplit).textSplit.some((w) => w.includes("\n")));

    sectionHistory = []; //free up a bit of memory? is that even a thing?
    return ret;
  }

  let sectionIndex = 0;
  let currentSection: string[] = [];
  let sectionHistory: string[] = [];

  let previousGetNextWordReturns: GetNextWordReturn[] = [];

  //generate next word
  async function getNextWord(
    wordIndex: number,
    wordsBound: number,
    previousWord: string | undefined,
    previousWord2: string | undefined,
  ): Promise<GetNextWordReturn> {
    if (currentWordset === null) {
      throw new WordGenError("Current wordset is null");
    }

    if (currentLanguage === null) {
      throw new WordGenError("Current language is null");
    }

    //because quote test can be repeated in the middle of a test
    //we cant rely on data inside previousGetNextWordReturns
    //because it might not include the full quote
    if (deps.isRepeated() && config().mode !== "quote") {
      const repeated = previousGetNextWordReturns[wordIndex];

      if (repeated === undefined) {
        // if the repeated word is undefined, that means we are out of words from the previous test
        // we need to either throw, or revert to random generation
        // reverting should only happen in certain cases

        let continueRandomGeneration = false;

        if (
          config().mode === "time" ||
          (config().mode === "custom" &&
            deps.customText.getLimitMode() === "time") ||
          (config().mode === "custom" &&
            deps.customText.getLimitMode() === "word" &&
            wordIndex < deps.customText.getLimitValue()) ||
          (config().mode === "custom" &&
            deps.customText.getLimitMode() === "section" &&
            sectionIndex < deps.customText.getLimitValue()) ||
          (config().mode === "words" && wordIndex < config().words)
        ) {
          continueRandomGeneration = true;
        }

        if (!continueRandomGeneration) {
          throw new WordGenError("Repeated word is undefined");
        }
      } else {
        sectionIndex++;
        return repeated;
      }
    }

    const funboxFrequency = getFunboxWordsFrequency() ?? "normal";
    let randomWord = currentWordset.randomWord(funboxFrequency);
    const previousWordRaw = previousWord
      ?.replace(/[.?!":\-,]/g, "")
      .toLowerCase();
    const previousWord2Raw = previousWord2
      ?.replace(/[.?!":\-,']/g, "")
      .toLowerCase();

    if (currentSection.length === 0) {
      const funboxSection = await getFunboxSection();

      if (config().mode === "quote") {
        randomWord = currentWordset.nextWord();
      } else if (
        config().mode === "custom" &&
        deps.customText.getMode() === "repeat"
      ) {
        randomWord = currentWordset.nextWord();
      } else if (
        config().mode === "custom" &&
        deps.customText.getMode() === "random" &&
        (currentWordset.length < 4 || deps.isPractiseWordsActive())
      ) {
        randomWord = currentWordset.randomWord(funboxFrequency);
      } else if (
        config().mode === "custom" &&
        deps.customText.getMode() === "shuffle"
      ) {
        randomWord = currentWordset.shuffledWord();
      } else if (
        config().mode === "custom" &&
        deps.customText.getLimitMode() === "section"
      ) {
        randomWord = currentWordset.randomWord(funboxFrequency);

        const previousSection = Arrays.nthElementFromArray(sectionHistory, -1);
        const previousSection2 = Arrays.nthElementFromArray(sectionHistory, -2);

        let regenerationCount = 0;
        while (
          regenerationCount < 100 &&
          (previousSection === randomWord || previousSection2 === randomWord)
        ) {
          regenerationCount++;
          randomWord = currentWordset.randomWord(funboxFrequency);
        }
      } else if (isCurrentlyUsingFunboxSection) {
        randomWord = funboxSection.join(" ");
      } else {
        let regenarationCount = 0; //infinite loop emergency stop button
        let firstAfterSplit = (
          randomWord.split(" ")[0] as string
        ).toLowerCase();
        let firstAfterSplitLazy = applyLazyModeToWord(
          firstAfterSplit,
          currentLanguage,
        );
        while (
          regenarationCount < 100 &&
          (previousWordRaw === firstAfterSplitLazy ||
            previousWord2Raw === firstAfterSplitLazy ||
            (config().mode !== "custom" &&
              !config().punctuation &&
              randomWord === "I") ||
            (config().mode !== "custom" &&
              !config().punctuation &&
              !config().language.startsWith("code") &&
              /[-=_+[\]{};'\\:"|,./<>?]/i.test(randomWord)) ||
            (config().mode !== "custom" &&
              !config().numbers &&
              /[0-9]/i.test(randomWord)))
        ) {
          regenarationCount++;
          randomWord = currentWordset.randomWord(funboxFrequency);
          firstAfterSplit = randomWord.split(" ")[0] as string;
          firstAfterSplitLazy = applyLazyModeToWord(
            firstAfterSplit,
            currentLanguage,
          );
        }
      }
      randomWord = randomWord.replace(/ +/g, " ");
      randomWord = randomWord.replace(/(^ )|( $)/g, "");

      randomWord = getFunboxWord(randomWord, wordIndex, currentWordset);

      currentSection = [...randomWord.split(" ")];
      sectionHistory.push(randomWord);
      randomWord = currentSection.shift() as string;
      sectionIndex++;
    } else {
      randomWord = currentSection.shift() as string;
    }

    if (randomWord === undefined) {
      throw new WordGenError("Random word is undefined");
    }

    if (randomWord === "") {
      throw new WordGenError("Random word is empty");
    }

    if (/ /g.test(randomWord)) {
      throw new WordGenError("Random word contains spaces");
    }

    const usingFunboxWithGetWord =
      getFunboxesWithFunction(deps.getActiveFunboxes(), "getWord").length > 0;
    const randomWordLanguage =
      (currentWordset instanceof PolyglotWordset
        ? currentWordset.wordsWithLanguage.get(randomWord)
        : config().language) ?? config().language; // Fall back to Config language if per-word language is unavailable

    if (
      config().mode !== "custom" &&
      config().mode !== "quote" &&
      /[A-Z]/.test(randomWord) &&
      !config().punctuation &&
      !randomWordLanguage.startsWith("german") &&
      !randomWordLanguage.startsWith("swiss_german") &&
      !randomWordLanguage.startsWith("code") &&
      !randomWordLanguage.startsWith("klingon") &&
      !isCurrentlyUsingFunboxSection &&
      !usingFunboxWithGetWord
    ) {
      randomWord = randomWord.toLowerCase();
    }

    randomWord = randomWord.replace(/ +/gm, " ");
    randomWord = randomWord.replace(/(^ )|( $)/gm, "");
    randomWord = applyLazyModeToWord(randomWord, currentLanguage);

    if (config().language.startsWith("swiss_german")) {
      randomWord = randomWord.replace(/ß/g, "ss");
    }

    if (
      config().punctuation &&
      !currentLanguage.originalPunctuation &&
      !isCurrentlyUsingFunboxSection
    ) {
      randomWord = await punctuateWord(
        previousWord,
        randomWord,
        wordIndex,
        wordsBound,
      );
    }

    randomWord = await applyBritishEnglishToWord(randomWord, previousWordRaw);

    randomWord = applyNumbersToWord(randomWord);

    randomWord = applyFunboxesToWord(randomWord, wordIndex, wordsBound);

    const ret = {
      word: appendCommitCharacter(randomWord),
      wordRaw: randomWord,
      sectionIndex: sectionIndex,
    };

    previousGetNextWordReturns.push(ret);

    return ret;
  }

  function areAllWordsGenerated(): boolean {
    return (
      (config().mode === "words" &&
        deps.getWordsLength() >= config().words &&
        config().words > 0) ||
      (config().mode === "custom" &&
        deps.customText.getLimitMode() === "word" &&
        deps.getWordsLength() >= deps.customText.getLimitValue() &&
        deps.customText.getLimitValue() !== 0) ||
      (config().mode === "quote" &&
        deps.getWordsLength() >=
          (deps.getCurrentQuote()?.textSplit?.length ?? 0)) ||
      (config().mode === "custom" &&
        deps.customText.getLimitMode() === "section" &&
        sectionIndex >= deps.customText.getLimitValue() &&
        currentSection.length === 0 &&
        deps.customText.getLimitValue() !== 0)
    );
  }

  return {
    generateWords,
    getNextWord,
    appendCommitCharacter,
    areAllWordsGenerated,
  };
}

export type {
  WordsGeneratorConfig,
  CustomTextSource,
  QuoteSource,
  WordTransforms,
  WordsGeneratorDeps,
  WordsGenerator,
  GenerateWordsReturn,
  GetNextWordReturn,
} from "./words-generator/types";
