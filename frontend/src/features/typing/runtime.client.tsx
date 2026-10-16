import { onCleanup, onMount } from "solid-js";

import { useChallengeEvents } from "../../ts/controllers/challenge-controller";
import { useQuoteEvents } from "../../ts/controllers/quotes-controller";
import { useSoundEvents } from "../../ts/controllers/sound-controller";
import {
  getLastEventLog,
  initializeTypingState,
  useKeymapEvents,
} from "../../ts/states/test";
import { addToGlobal } from "../../ts/utils/misc";
import { buildEventLog } from "./runtime/events/data";
import { useFunboxEvents } from "./runtime/funbox/funbox";
import { usePaceCaretEvents } from "./runtime/pace-caret";
import { usePractiseEvents } from "./runtime/practise-words";
import { useTestLogicEvents } from "./runtime/test-logic";
import * as TestTimer from "./runtime/test-timer";
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
  onMount(() => {
    onCleanup(
      addToGlobal({
        enableTimerDebug: TestTimer.enableTimerDebug,
        toggleSmoothedBurst: async () => {
          const Result = await import("./runtime/result");
          Result.toggleSmoothedBurst();
        },
        lastEventLog: getLastEventLog,
        currentEventLog: buildEventLog,
      }),
    );
  });
  return null;
}
