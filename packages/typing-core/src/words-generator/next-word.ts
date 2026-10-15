import { getFunboxesWithFunction } from "../active-funboxes";
import * as Arrays from "../arrays";
import { WordGenError } from "../errors";
import { PolyglotWordset } from "../wordset";
import type { createFunboxWords } from "./funboxes";
import type { createPunctuation } from "./punctuation";
import type { GeneratorState } from "./state";
import type { createWordTransforms } from "./transforms";
import type {
  GetNextWordReturn,
  WordsGenerator,
  WordsGeneratorConfig,
  WordsGeneratorDeps,
} from "./types";

type WordTools = ReturnType<typeof createFunboxWords> &
  ReturnType<typeof createWordTransforms> & {
    punctuateWord: ReturnType<typeof createPunctuation>;
  };

export function createNextWord(
  deps: WordsGeneratorDeps,
  state: GeneratorState,
  tools: WordTools,
): WordsGenerator["getNextWord"] {
  const config = (): WordsGeneratorConfig => deps.getConfig();
  const {
    getFunboxWordsFrequency,
    getFunboxSection,
    getFunboxWord,
    applyFunboxesToWord,
    appendCommitCharacter,
    applyLazyModeToWord,
    applyBritishEnglishToWord,
    applyNumbersToWord,
    punctuateWord,
  } = tools;

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

  return getNextWord;
}
