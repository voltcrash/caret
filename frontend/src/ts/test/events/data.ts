import { onCleanup } from "solid-js";
import { createAppOwned } from "../../../app/application";
import { appMethod } from "../../../app/state";
import { createTestSession } from "@oxytype/typing-core/session";
import { EventLogContext } from "@oxytype/typing-core/events/types";
import { getLiveCache } from "./live-cache";
import * as TestWords from "../test-words";
import { getMutableConfig } from "../../config/store";
import * as CustomText from "../custom-text";
import { getMode2 } from "../../utils/misc";
import {
  getKoreanStatus,
  getActiveWordIndex,
  getCurrentQuote,
  getBailedOut,
  isResultCalculating,
} from "../../states/test";
import { isFunboxActiveWithProperty } from "../funbox/active";
import * as SlowTimer from "../../states/slow-timer";
export const getTestSession = createAppOwned(() => {
  const session = createTestSession(() => getMutableConfig(), {
    getContext,
    getActiveWordIndex: () => getActiveWordIndex(),
    isResultCalculating: () => isResultCalculating(),
    liveCache: getLiveCache(),
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
