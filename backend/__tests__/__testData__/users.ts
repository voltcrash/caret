import { PersonalBest } from "@caret/schemas/shared";

export function pb(
  wpm: number,
  acc: number = 90,
  timestamp: number = 1,
): PersonalBest {
  return {
    acc,
    consistency: 100,
    difficulty: "normal",
    lazyMode: false,
    language: "english",
    punctuation: false,
    raw: wpm + 1,
    wpm,
    timestamp,
  };
}
