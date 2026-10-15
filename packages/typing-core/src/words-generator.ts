import { createNextWord } from "./words-generator/next-word";
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

  const transforms = createWordTransforms(
    deps,
    () => state.currentWordset,
    random,
  );
  const punctuateWord = createPunctuation(deps, random);
  const funboxes = createFunboxWords(deps);
  const { getWordOrder, appendCommitCharacter } = funboxes;
  const getNextWord = createNextWord(deps, state, {
    ...transforms,
    ...funboxes,
    punctuateWord,
  });

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
