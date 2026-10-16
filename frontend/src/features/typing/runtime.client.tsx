import { useChallengeEvents } from "../../ts/controllers/challenge-controller";
import { useQuoteEvents } from "../../ts/controllers/quotes-controller";
import { useSoundEvents } from "../../ts/controllers/sound-controller";
import { initializeTypingState, useKeymapEvents } from "../../ts/states/test";
import { useFunboxEvents } from "./runtime/funbox/funbox";
import { usePaceCaretEvents } from "./runtime/pace-caret";
import { usePractiseEvents } from "./runtime/practise-words";
import { useTestLogicEvents } from "./runtime/test-logic";
import { useTtsEvents } from "./runtime/tts";

/** Session subscriptions belong to the mounted typing leaf. */
export function TypingRuntime(): null {
  initializeTypingState();
  useKeymapEvents();
  useChallengeEvents();
  useQuoteEvents();
  useSoundEvents();
  useFunboxEvents();
  usePaceCaretEvents();
  usePractiseEvents();
  useTestLogicEvents();
  useTtsEvents();
  return null;
}
