import type { Config } from "@caret/typing-engine/config";

/** Generation identity only: scoring/input preferences do not change words. */
export function initialContentConfig(config: Config): Partial<Config> {
  return {
    mode: config.mode,
    time: config.time,
    words: config.words,
    language: config.language,
    funbox: config.funbox,
    showAllLines: config.showAllLines,
    punctuation: config.punctuation,
    numbers: config.numbers,
    lazyMode: config.lazyMode,
    britishEnglish: config.britishEnglish,
    quoteLength: config.quoteLength,
    customPolyglot: config.customPolyglot,
  };
}
