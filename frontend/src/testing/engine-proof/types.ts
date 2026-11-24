import type { BrowserSession } from "@caret/typing-engine/browser.client";

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
