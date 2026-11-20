import { onCleanup, onMount } from "solid-js";

import { useSoundEvents } from "../../ts/controllers/sound-controller";
import {
  getLastEventLog,
  getActiveWordIndex,
  initializeTypingState,
  useKeymapEvents,
} from "../../ts/states/test";
import { addToGlobal } from "../../ts/utils/misc";
import { getBrowserEngine } from "./engine/owner.client";
import { useChallengeEvents } from "./runtime/challenge-controller";
import { usePractiseEvents } from "./runtime/content/practise-words";
import { buildEventLog, getTestSession } from "./runtime/events/data";
import { useFunboxEvents } from "./runtime/funbox/funbox";
import { useEngineInputProjection } from "./runtime/input-projection.client";
import { usePaceCaretEvents } from "./runtime/pace-caret";
import { useQuoteEvents } from "./runtime/quotes-controller";
import { useTestLogicEvents } from "./runtime/test/logic";
import * as TestTimer from "./runtime/test/timer";
import { useTtsEvents } from "./runtime/tts";

/** Session subscriptions belong to the mounted typing leaf. */
export function TypingRuntime(): null {
  initializeTypingState();
  useEngineInputProjection();
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
          const Result = await import("./runtime/result/screen");
          Result.toggleSmoothedBurst();
        },
        lastEventLog: getLastEventLog,
        ...(import.meta.env.CARET_ENGINE_PROOF
          ? {
              engineMigrationMemory: () =>
                getBrowserEngine().api().memoryBytes(),
              engineMigrationState: () => ({
                wordIndex: getActiveWordIndex(),
                reason: getTestSession().getFinishReason(),
              }),
            }
          : {}),
        currentEventLog: buildEventLog,
      }),
    );
  });
  return null;
}
