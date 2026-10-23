// Temporary oracle-test adapter only. Retire with typing-core in Phase 2.6.
// Production website consumers use the Rust session; these tests construct
// deliberately synthetic legacy logs pending their native analysis migration.
import { onCleanup } from "solid-js";
import { createAppOwned } from "../../src/app/application";
import { appMethod } from "../../src/app/state";
import { createTestSession } from "@oxytype/typing-core/session";
import { EventLogContext } from "@oxytype/web-shared/events/types";
import * as TestWords from "../../src/features/typing/runtime/test-words";
import { getMutableConfig } from "../../src/ts/config/store";
import * as CustomText from "../../src/features/typing/runtime/custom-text";
import { getMode2 } from "../../src/ts/utils/misc";
import {
  getKoreanStatus,
  getActiveWordIndex,
  getCurrentQuote,
  getBailedOut,
  isResultCalculating,
} from "../../src/ts/states/test";
import { isFunboxActiveWithProperty } from "../../src/features/typing/runtime/funbox/active";
import * as SlowTimer from "../../src/ts/states/slow-timer";
export const getTestSession = createAppOwned(() => {
  const session = createTestSession(() => getMutableConfig(), {
    getContext,
    getActiveWordIndex: () => getActiveWordIndex(),
    isResultCalculating: () => isResultCalculating(),
    customLimit: () => CustomText.getLimit(),
    isSlowTimer: () => SlowTimer.get(),
  });
  onCleanup(() => session.reset());
  return session;
});
export const logTestEvent = appMethod(
  () => getTestSession().recorder.logTestEvent,
);
export const getCurrentInput = appMethod(
  () => getTestSession().recorder.getCurrentInput,
);
export const getInputForWord = appMethod(
  () => getTestSession().recorder.getInputForWord,
);
export const cleanupData = appMethod(
  () => getTestSession().recorder.cleanupData,
);
export const getAllTestEvents = appMethod(
  () => getTestSession().recorder.getAllTestEvents,
);
export const logEventsDataToTheConsoleTable = appMethod(
  () => getTestSession().recorder.logEventsDataToTheConsoleTable,
);
export const forceReleaseAllKeys = appMethod(
  () => getTestSession().recorder.forceReleaseAllKeys,
);
function getContext(): EventLogContext {
  const context = {
    targetWords: [...TestWords.words.get().map((w) => w.textWithCommit)],
    mode: getMutableConfig().mode,
    mode2: getMode2(getMutableConfig(), getCurrentQuote()),
    koreanStatus: getKoreanStatus(),
    bailedOut: getBailedOut(),
    ...(getMutableConfig().mode === "custom" && {
      customTextLimitMode: CustomText.getLimit().mode,
      customTextLimitValue: CustomText.getLimit().value,
    }),
    ...(getMutableConfig().funbox.length !== 0 && {
      isFunboxWithNospacePropertyActive: isFunboxActiveWithProperty("nospace"),
    }),
  };

  return context;
}
export const resetTestEvents = (): void => getTestSession().reset();
export const buildEventLog = (): ReturnType<
  ReturnType<typeof getTestSession>["buildEventLog"]
> => getTestSession().buildEventLog();
