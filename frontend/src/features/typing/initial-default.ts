import { getDefaultConfig } from "@caret/web-shared/config/default-config";
import { initialTyping } from "virtual:initial-typing";
import {
  previewSettings,
  type InitialTypingSnapshot,
} from "./initial-snapshot";

export function defaultInitialTyping(): InitialTypingSnapshot {
  return {
    version: 1,
    seed: initialTyping.seed,
    key: initialTyping.key,
    engineHash: initialTyping.engineHash,
    words: initialTyping.words,
    settings: previewSettings(getDefaultConfig()),
  };
}
