import { useChallengeEvents } from "../ts/controllers/challenge-controller";
import { useQuoteEvents } from "../ts/controllers/quotes-controller";
import { useSoundEvents } from "../ts/controllers/sound-controller";
import { initializeTypingState, useKeymapEvents } from "../ts/states/test";
import { useFunboxEvents } from "../ts/test/funbox/funbox";
import { usePaceCaretEvents } from "../ts/test/pace-caret";
import { usePractiseEvents } from "../ts/test/practise-words";
import { useTestLogicEvents } from "../ts/test/test-logic";
import { useTtsEvents } from "../ts/test/tts";

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
