import type { BrowserSession, Text } from "@caret/typing-engine/browser.client";

export type ProofRunnerContext = {
  fixture: string;
  isDisposed: () => boolean;
  handles: Set<BrowserSession>;
  loaders: Set<{ dispose: () => void }>;
  setBenchmark: (value: string) => void;
  replaceTypingSession: (create: () => BrowserSession) => BrowserSession;
  resetSlice: () => void;
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function stripWordTrailingWhitespace(
  word: Text | undefined,
): Text | null {
  return word === undefined
    ? null
    : [32, 10].includes(word.at(-1) ?? -1)
      ? word.slice(0, -1)
      : word;
}
