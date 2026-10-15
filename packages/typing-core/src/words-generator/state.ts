import type { LanguageObject } from "@oxytype/schemas/languages";
import type { Wordset } from "../wordset";
import type { GetNextWordReturn } from "./types";

export type GeneratorState = {
  currentWordset: Wordset | null;
  currentLanguage: LanguageObject | null;
  isCurrentlyUsingFunboxSection: boolean;
  sectionIndex: number;
  currentSection: string[];
  sectionHistory: string[];
  previousGetNextWordReturns: GetNextWordReturn[];
};

export function createGeneratorState(): GeneratorState {
  return {
    currentWordset: null,
    currentLanguage: null,
    isCurrentlyUsingFunboxSection: false,
    sectionIndex: 0,
    currentSection: [],
    sectionHistory: [],
    previousGetNextWordReturns: [],
  };
}
