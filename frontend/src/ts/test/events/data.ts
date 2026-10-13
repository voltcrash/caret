import { createTestSession } from "@oxytype/typing-core/session";
import { EventLogContext } from "@oxytype/typing-core/events/types";
import { liveCache } from "./live-cache";
import * as TestWords from "../test-words";
import { Config } from "../../config/store";
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
export const testSession = createTestSession(() => Config, {
  getContext,
  getActiveWordIndex: () => getActiveWordIndex(),
  isResultCalculating: () => isResultCalculating(),
  liveCache,
});
export const {
  logTestEvent,
  getCurrentInput,
  getInputForWord,
  cleanupData,
  getAllTestEvents,
  logEventsDataToTheConsoleTable,
  forceReleaseAllKeys,
  __testing,
} = testSession.recorder;
function getContext(): EventLogContext {
  const context = {
    targetWords: [...TestWords.words.get().map((w) => w.textWithCommit)],
    mode: Config.mode,
    mode2: getMode2(Config, getCurrentQuote()),
    koreanStatus: getKoreanStatus(),
    bailedOut: getBailedOut(),
    ...(Config.mode === "custom" && {
      customTextLimitMode: CustomText.getLimit().mode,
      customTextLimitValue: CustomText.getLimit().value,
    }),
    ...(Config.funbox.length !== 0 && {
      isFunboxWithNospacePropertyActive: isFunboxActiveWithProperty("nospace"),
    }),
  };

  return context;
}
export const resetTestEvents = (): void => testSession.reset();
export const buildEventLog = (): ReturnType<typeof testSession.buildEventLog> =>
  testSession.buildEventLog();
