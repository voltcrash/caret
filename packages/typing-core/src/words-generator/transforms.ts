import type { LanguageObject } from "@oxytype/schemas/languages";
import * as GetText from "../generate";
import * as Numerals from "../numerals";
import { PolyglotWordset, type Wordset } from "../wordset";
import type { WordsGeneratorDeps, WordsGeneratorConfig } from "./types";

export function createWordTransforms(
  deps: WordsGeneratorDeps,
  getWordset: () => Wordset | null,
  random: () => number,
): {
  applyBritishEnglishToWord: (
    word: string,
    previousWord: string | undefined,
  ) => Promise<string>;
  applyLazyModeToWord: (word: string, language: LanguageObject) => string;
  applyNumbersToWord: (word: string) => string;
} {
  const config = (): WordsGeneratorConfig => deps.getConfig();

  async function applyBritishEnglishToWord(
    word: string,
    previousWord: string | undefined,
  ): Promise<string> {
    if (!config().britishEnglish) return word;
    if (!config().language.includes("english")) return word;
    const currentQuote = deps.getCurrentQuote();
    if (
      config().mode === "quote" &&
      currentQuote?.britishText !== undefined &&
      currentQuote?.britishText !== ""
    ) {
      return word;
    }

    return await deps.transforms.britishEnglish(word, previousWord);
  }

  function applyLazyModeToWord(word: string, language: LanguageObject): string {
    const currentWordset = getWordset();
    // polyglot mode, use the word's actual language
    if (currentWordset && currentWordset instanceof PolyglotWordset) {
      const langName = currentWordset.wordsWithLanguage.get(word);
      const langProps = langName
        ? currentWordset.languageProperties.get(langName)
        : undefined;
      const allowLazyMode =
        (langProps && !langProps.noLazyMode) === true ||
        config().mode === "custom";
      if (config().lazyMode && allowLazyMode && langProps) {
        word = deps.transforms.replaceAccents(
          word,
          langProps.additionalAccents,
        );
      }
      return word;
    }

    // normal mode
    const allowLazyMode = !language.noLazyMode || config().mode === "custom";
    if (config().lazyMode && allowLazyMode) {
      word = deps.transforms.replaceAccents(word, language.additionalAccents);
    }
    return word;
  }

  function applyNumbersToWord(randomWord: string): string {
    if (config().numbers) {
      if (random() < 0.1) {
        randomWord = GetText.getNumbers(4);

        if (config().language.startsWith("kurdish")) {
          randomWord = Numerals.convertNumberToArabic(randomWord);
        } else if (config().language.startsWith("nepali")) {
          randomWord = Numerals.convertNumberToNepali(randomWord);
        } else if (config().language.startsWith("bangla")) {
          randomWord = Numerals.convertNumberToBangla(randomWord);
        } else if (config().language.startsWith("hindi")) {
          randomWord = Numerals.convertNumberToHindi(randomWord);
        }
      }
    }

    return randomWord;
  }

  return { applyBritishEnglishToWord, applyLazyModeToWord, applyNumbersToWord };
}
