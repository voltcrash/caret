import { useFunboxEvents } from "../features/typing/runtime/funbox/funbox";
import { usePaceCaretEvents } from "../features/typing/runtime/pace-caret";
import { usePractiseEvents } from "../features/typing/runtime/practise-words";
import { useTestLogicEvents } from "../features/typing/runtime/test-logic";
import { useTtsEvents } from "../features/typing/runtime/tts";
import { useChallengeEvents } from "../ts/controllers/challenge-controller";
import { useQuoteEvents } from "../ts/controllers/quotes-controller";
import { useSoundEvents } from "../ts/controllers/sound-controller";
import { initializeTypingState, useKeymapEvents } from "../ts/states/test";

/** Session integrations; the typing route will own this component in Stage 5. */
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
