import {
  findSingleFunboxWithFunction,
  getFunboxesWithFunction,
  hasFunboxWithProperty,
} from "../active-funboxes";
import type { FunboxWordOrder } from "../languages";
import type { FunboxWordsFrequency, Wordset } from "../wordset";
import type { WordsGeneratorDeps, WordsGeneratorConfig } from "./types";

export function createFunboxWords(deps: WordsGeneratorDeps): {
  getFunboxWordsFrequency: () => FunboxWordsFrequency | undefined;
  getFunboxSection: () => Promise<string[]>;
  getFunboxWord: (word: string, wordIndex: number, wordset?: Wordset) => string;
  applyFunboxesToWord: (
    word: string,
    wordIndex: number,
    wordsBound: number,
  ) => string;
  getWordOrder: () => FunboxWordOrder;
  appendCommitCharacter: (word: string) => string;
} {
  const config = (): WordsGeneratorConfig => deps.getConfig();

  function getFunboxWordsFrequency(): FunboxWordsFrequency | undefined {
    const funbox = findSingleFunboxWithFunction(
      deps.getActiveFunboxes(),
      "getWordsFrequencyMode",
    );
    if (funbox) {
      return funbox.functions.getWordsFrequencyMode();
    }
    return undefined;
  }

  async function getFunboxSection(): Promise<string[]> {
    const ret = [];

    const funbox = findSingleFunboxWithFunction(
      deps.getActiveFunboxes(),
      "pullSection",
    );

    if (funbox) {
      const section = await funbox.functions.pullSection(config().language);

      if (section === false || section === undefined) {
        deps.disableFunbox(funbox.name);
        throw new Error("Failed to pull section");
      }

      for (const word of section.words) {
        if (ret.length >= config().words && config().mode === "words") {
          break;
        }
        ret.push(word);
      }
    }
    return ret;
  }

  function getFunboxWord(
    word: string,
    wordIndex: number,
    wordset?: Wordset,
  ): string {
    const funbox = findSingleFunboxWithFunction(
      deps.getActiveFunboxes(),
      "getWord",
    );

    if (funbox) {
      word = funbox.functions.getWord(wordset, wordIndex);
    }
    return word;
  }

  function applyFunboxesToWord(
    word: string,
    wordIndex: number,
    wordsBound: number,
  ): string {
    for (const fb of getFunboxesWithFunction(
      deps.getActiveFunboxes(),
      "alterText",
    )) {
      word = fb.functions.alterText(word, wordIndex, wordsBound);
    }
    return word;
  }

  function getWordOrder(): FunboxWordOrder {
    const wordOrderProperty = deps
      .getActiveFunboxes()
      .flatMap((fb) => fb.properties ?? [])
      .find((prop) => prop.startsWith("wordOrder:"));

    return (wordOrderProperty?.split(":")[1] as FunboxWordOrder) ?? "normal";
  }

  /**
   * Appends the inter-word commit separator the way the generator does: a trailing
   * space, unless the word already ends with a newline or the nospace funbox is
   * active. Callers that push words outside of getNextWord (e.g. section funbox
   * pulls) must use this so the separator is part of the target word.
   */
  function appendCommitCharacter(word: string): string {
    if (
      word.endsWith("\n") ||
      hasFunboxWithProperty(deps.getActiveFunboxes(), "nospace")
    ) {
      return word;
    }
    return `${word} `;
  }

  return {
    getFunboxWordsFrequency,
    getFunboxSection,
    getFunboxWord,
    applyFunboxesToWord,
    getWordOrder,
    appendCommitCharacter,
  };
}
