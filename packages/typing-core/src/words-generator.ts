import { createGeneratorState } from "./words-generator/state";
import { getQuoteWordList } from "./words-generator/quotes";
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
import { QuoteWithTextSplit } from "./quotes";
import { PolyglotWordset, withWords } from "./wordset";

//pin implementation
const random = Math.random;

export function createWordsGenerator(deps: WordsGeneratorDeps): WordsGenerator {
  const config = (): WordsGeneratorConfig => deps.getConfig();
  const state = createGeneratorState();

  const { applyBritishEnglishToWord, applyLazyModeToWord, applyNumbersToWord } =
    createWordTransforms(deps, () => state.currentWordset, random);
  const punctuateWord = createPunctuation(deps, random);
  const {
    getFunboxWordsFrequency,
    getFunboxSection,
    getFunboxWord,
    applyFunboxesToWord,
    getWordOrder,
    appendCommitCharacter,
  } = createFunboxWords(deps);

  let previousRandomQuote: QuoteWithTextSplit | null = null;

  async function generateWords(
    language: LanguageObject,
  ): Promise<GenerateWordsReturn> {
    if (!deps.isRepeated()) {
      state.previousGetNextWordReturns = [];
    }
    previousRandomQuote = deps.getCurrentQuote();
    deps.setCurrentQuote(null);
    state.currentSection = [];
    state.sectionIndex = 0;
    state.sectionHistory = [];
    state.currentLanguage = language;
    const rawWordList: string[] = [];
    const ret: GenerateWordsReturn = {
      words: [],
      sectionIndexes: [],
      hasTab: false,
      hasNewline: false,
      allRightToLeft: language.rightToLeft,
      allJoiningScript: language.joiningScript ?? false,
    };

    state.isCurrentlyUsingFunboxSection =
      getFunboxesWithFunction(deps.getActiveFunboxes(), "pullSection").length >
      0;

    const wordOrder = getWordOrder();

    let wordList = language.words;
    if (config().mode === "custom") {
      wordList = deps.customText.getText();
    } else if (config().mode === "quote") {
      wordList = await getQuoteWordList(
        deps,
        language,
        state.currentWordset,
        previousRandomQuote,
        wordOrder,
      );
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
        state.currentWordset = polyglotResult;
        // set allJoiningScript if any language in languageProperties has joiningScript: true
        ret.allJoiningScript = Array.from(
          polyglotResult.languageProperties.values(),
        ).some((props) => !!props.joiningScript);
      } else {
        state.currentWordset = result;
      }
    } else {
      state.currentWordset = await withWords(wordList);
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
          state.currentSection.length === 0 && state.sectionIndex >= limit;
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
      state.currentWordset.words.some((w) => w.includes("\t")) ||
      (config().mode === "quote" &&
        (quote as QuoteWithTextSplit).textSplit.some((w) => w.includes("\t")));
    ret.hasNewline =
      ret.words.some((w) => w.includes("\n")) ||
      state.currentWordset.words.some((w) => w.includes("\n")) ||
      (config().mode === "quote" &&
        (quote as QuoteWithTextSplit).textSplit.some((w) => w.includes("\n")));

    state.sectionHistory = []; //free up a bit of memory? is that even a thing?
    return ret;
  }

  //generate next word
  async function getNextWord(
    wordIndex: number,
    wordsBound: number,
    previousWord: string | undefined,
    previousWord2: string | undefined,
  ): Promise<GetNextWordReturn> {
    if (state.currentWordset === null) {
      throw new WordGenError("Current wordset is null");
    }

    if (state.currentLanguage === null) {
      throw new WordGenError("Current language is null");
    }

    //because quote test can be repeated in the middle of a test
    //we cant rely on data inside state.previousGetNextWordReturns
    //because it might not include the full quote
    if (deps.isRepeated() && config().mode !== "quote") {
      const repeated = state.previousGetNextWordReturns[wordIndex];

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
            state.sectionIndex < deps.customText.getLimitValue()) ||
          (config().mode === "words" && wordIndex < config().words)
        ) {
          continueRandomGeneration = true;
        }

        if (!continueRandomGeneration) {
          throw new WordGenError("Repeated word is undefined");
        }
      } else {
        state.sectionIndex++;
        return repeated;
      }
    }

    const funboxFrequency = getFunboxWordsFrequency() ?? "normal";
    let randomWord = state.currentWordset.randomWord(funboxFrequency);
    const previousWordRaw = previousWord
      ?.replace(/[.?!":\-,]/g, "")
      .toLowerCase();
    const previousWord2Raw = previousWord2
      ?.replace(/[.?!":\-,']/g, "")
      .toLowerCase();

    if (state.currentSection.length === 0) {
      const funboxSection = await getFunboxSection();

      if (config().mode === "quote") {
        randomWord = state.currentWordset.nextWord();
      } else if (
        config().mode === "custom" &&
        deps.customText.getMode() === "repeat"
      ) {
        randomWord = state.currentWordset.nextWord();
      } else if (
        config().mode === "custom" &&
        deps.customText.getMode() === "random" &&
        (state.currentWordset.length < 4 || deps.isPractiseWordsActive())
      ) {
        randomWord = state.currentWordset.randomWord(funboxFrequency);
      } else if (
        config().mode === "custom" &&
        deps.customText.getMode() === "shuffle"
      ) {
        randomWord = state.currentWordset.shuffledWord();
      } else if (
        config().mode === "custom" &&
        deps.customText.getLimitMode() === "section"
      ) {
        randomWord = state.currentWordset.randomWord(funboxFrequency);

        const previousSection = Arrays.nthElementFromArray(
          state.sectionHistory,
          -1,
        );
        const previousSection2 = Arrays.nthElementFromArray(
          state.sectionHistory,
          -2,
        );

        let regenerationCount = 0;
        while (
          regenerationCount < 100 &&
          (previousSection === randomWord || previousSection2 === randomWord)
        ) {
          regenerationCount++;
          randomWord = state.currentWordset.randomWord(funboxFrequency);
        }
      } else if (state.isCurrentlyUsingFunboxSection) {
        randomWord = funboxSection.join(" ");
      } else {
        let regenarationCount = 0; //infinite loop emergency stop button
        let firstAfterSplit = (
          randomWord.split(" ")[0] as string
        ).toLowerCase();
        let firstAfterSplitLazy = applyLazyModeToWord(
          firstAfterSplit,
          state.currentLanguage,
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
          randomWord = state.currentWordset.randomWord(funboxFrequency);
          firstAfterSplit = randomWord.split(" ")[0] as string;
          firstAfterSplitLazy = applyLazyModeToWord(
            firstAfterSplit,
            state.currentLanguage,
          );
        }
      }
      randomWord = randomWord.replace(/ +/g, " ");
      randomWord = randomWord.replace(/(^ )|( $)/g, "");

      randomWord = getFunboxWord(randomWord, wordIndex, state.currentWordset);

      state.currentSection = [...randomWord.split(" ")];
      state.sectionHistory.push(randomWord);
      randomWord = state.currentSection.shift() as string;
      state.sectionIndex++;
    } else {
      randomWord = state.currentSection.shift() as string;
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
      (state.currentWordset instanceof PolyglotWordset
        ? state.currentWordset.wordsWithLanguage.get(randomWord)
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
      !state.isCurrentlyUsingFunboxSection &&
      !usingFunboxWithGetWord
    ) {
      randomWord = randomWord.toLowerCase();
    }

    randomWord = randomWord.replace(/ +/gm, " ");
    randomWord = randomWord.replace(/(^ )|( $)/gm, "");
    randomWord = applyLazyModeToWord(randomWord, state.currentLanguage);

    if (config().language.startsWith("swiss_german")) {
      randomWord = randomWord.replace(/ß/g, "ss");
    }

    if (
      config().punctuation &&
      !state.currentLanguage.originalPunctuation &&
      !state.isCurrentlyUsingFunboxSection
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
      sectionIndex: state.sectionIndex,
    };

    state.previousGetNextWordReturns.push(ret);

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
        state.sectionIndex >= deps.customText.getLimitValue() &&
        state.currentSection.length === 0 &&
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
