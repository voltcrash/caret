import type { PlaybackSnapshot } from "@caret/typing-engine/browser.client";

type Word = PlaybackSnapshot["words"][number];
export type ReplayLetter = Omit<Word["letters"][number], "char"> & {
  char: string;
};
export type ReplayWord = Omit<Word, "letters"> & { letters: ReplayLetter[] };
