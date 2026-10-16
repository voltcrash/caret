import { captureTypingRoute } from "../scope";
import { animateAsync } from "../../../ts/anim";
import { updateClassNames } from "../../../ts/utils/cn";

import * as TestUI from "./test-ui";

import * as Misc from "../../../ts/utils/misc";

import {
  showNoticeNotification,
  showErrorNotification,
  showSuccessNotification,
} from "../../../ts/states/notifications";
import * as CustomText from "./custom-text";

import * as PaceCaret from "./pace-caret";
import * as TestTimer from "./test-timer";
import * as DB from "../../../ts/db";

import * as TodayTracker from "./today-tracker";
import * as ChallengeContoller from "../../../ts/controllers/challenge-controller";

import { prepareResultScreen } from "../../../ts/states/result";
import {
  getCustomTextIndicator,
  isAuthenticated,
} from "../../../ts/states/core";
import {
  setLastEventLog,
  getCurrentQuote,
  getIncompleteSeconds,
  getIncompleteTests,
  getRestartCount,
  isRepeated,
  isTestActive,
  pushIncompleteTest,
  resetIncompleteTests,
  setIsRepeated,
  setIsTestInvalid,
  setLastResult,
  getBailedOut,
  setLastSignedOutResult,
  setResultCalculating,
  setResultLoading,
  setResultVisible,
  setTestActive,
} from "../../../ts/states/test";

import * as TestWords from "./test-words";

import * as AnalyticsController from "../../../ts/controllers/analytics-controller";

import { getAuthenticatedUser } from "../../../ts/auth-client";

import {
  CompletedEvent,
  CompletedEventCustomText,
} from "@oxytype/schemas/results";

import { getTypingTestElement } from "../../../ts/states/test-dom";

import { getMutableConfig } from "../../../ts/config/store";

import {
  getTestSession,
  cleanupData,
  logEventsDataToTheConsoleTable,
  forceReleaseAllKeys,
  buildEventLog,
} from "./events/data";
import {
  getIncompleteTestSeconds,
  getDateBasedTestDurationMs,
  getInputHistory,
} from "@oxytype/typing-core/events/stats";
import {
  getInvalidResultReason,
  InvalidResultReason,
  isAfkResult,
} from "@oxytype/typing-core/result-validity";

import { isDevEnvironment } from "../../../ts/utils/env";

import { countInvalidResultFields } from "@oxytype/typing-core/result-fields";

import { saveResult } from "./result-saving";
const invalidMessages: Record<
  Exclude<InvalidResultReason, "failed">,
  string
> = {
  "inconsistent duration": "inconsistent test duration",
  "too short": "too short",
  afk: "AFK detected",
  repeated: "repeated",
  wpm: "wpm",
  raw: "raw",
  accuracy: "accuracy",
};

function getCompletedEventCustomText(): CompletedEventCustomText | undefined {
  if (getMutableConfig().mode !== "custom") return undefined;
  const temp = CustomText.getData();
  return {
    textLen: temp.text.length,
    mode: temp.mode,
    pipeDelimiter: temp.pipeDelimiter,
    limit: temp.limit,
  };
}

export async function finish(difficultyFailed = false): Promise<void> {
  const lease = captureTypingRoute();
  if (!isTestActive() || !lease.isCurrent()) return;
  setResultCalculating(true);
  const now = performance.now();
  TestTimer.clear();
  getTestSession().end(now);
  const resultReady = Promise.all([import("./result"), prepareResultScreen()]);

  // fade out the test and show loading
  // because the css animation has a delay,
  // if the test calculation is fast the loading will not show
  await animateAsync(getTypingTestElement(), {
    opacity: 0,
    duration: Misc.applyReducedMotion(125),
  });
  if (!lease.isCurrent()) return;
  const typingTest = getTypingTestElement();
  typingTest.className = updateClassNames(typingTest.className, "hidden", true);
  setResultLoading(true);
  await Misc.sleep(0); //allow ui update
  if (!lease.isCurrent()) return;

  TestUI.onTestFinish();

  if (isRepeated() && getMutableConfig().mode === "quote") {
    setIsRepeated(false);
  }

  forceReleaseAllKeys();

  setResultVisible(true);
  setTestActive(false);

  cleanupData();
  const [Result] = await resultReady;
  if (!lease.isCurrent()) return;

  if (isDevEnvironment()) {
    logEventsDataToTheConsoleTable();
  }

  const eventLog = buildEventLog();
  const tags = isAuthenticated()
    ? (await import("../../../ts/collections/tags"))
        .getActiveTags()
        .map((tag) => tag._id)
    : [];
  if (!lease.isCurrent()) return;
  const ce = getTestSession().complete(eventLog, {
    config: getMutableConfig(),
    currentQuote: getCurrentQuote(),
    customText: getCompletedEventCustomText(),
    tags,
    bailedOut: getBailedOut(),
    restartCount: getRestartCount(),
    incompleteTests: getIncompleteTests(),
    incompleteSeconds: getIncompleteSeconds(),
    timestamp: Date.now(),
  });
  PaceCaret.setLastTestWpm(ce.wpm);

  console.debug("Completed event object", ce);

  let dontSave = false;

  if (countInvalidResultFields(ce) > 0) {
    console.log(ce);
    showErrorNotification(
      "Failed to build result object: One of the fields is undefined or NaN",
    );
    dontSave = true;
  }

  const completedEvent = structuredClone(ce) as CompletedEvent;

  setLastEventLog(eventLog);
  setLastResult(structuredClone(completedEvent));

  ///////// completed event ready

  const failReason = getTestSession().getFinishReason() ?? "";
  const afkDetected = isAfkResult(eventLog, getBailedOut());
  const invalidReason = getInvalidResultReason({
    result: completedEvent,
    eventLog,
    bailedOut: getBailedOut(),
    failed: difficultyFailed,
    repeated: isRepeated(),
    lbOptOut: DB.getSnapshot()?.lbOptOut === true,
    customLimit: CustomText.getData().limit,
  });
  const tooShort = invalidReason === "too short";
  if (invalidReason === "failed") {
    showNoticeNotification(`Test failed - ${failReason}`, {
      durationMs: 1000,
    });
    dontSave = true;
  } else if (invalidReason !== undefined) {
    if (invalidReason === "inconsistent duration") {
      console.error(
        "Test duration inconsistent",
        ce.testDuration,
        getDateBasedTestDurationMs(eventLog) / 1000,
      );
    }
    showNoticeNotification(`Test invalid - ${invalidMessages[invalidReason]}`);
    setIsTestInvalid(true);
    dontSave = true;
  }

  // test is valid

  if (isRepeated() || difficultyFailed) {
    if (getMutableConfig().resultSaving) {
      pushIncompleteTest({
        acc: completedEvent.acc,
        seconds: getIncompleteTestSeconds(eventLog),
      });
    }
  }

  const customTextName = getCustomTextIndicator()?.name ?? "";
  const isLong = getCustomTextIndicator()?.isLong === true;
  if (getMutableConfig().mode === "custom" && customTextName !== "" && isLong) {
    // Let's update the custom text progress
    if (
      getBailedOut() ||
      getInputHistory(eventLog).length < TestWords.words.length
    ) {
      // They bailed out

      const history = getInputHistory(eventLog);
      let historyLength = history?.length;
      const wordIndex = historyLength - 1;

      const lastWordInputLength = history[wordIndex]?.length ?? 0;

      // compare against display.length (not textWithCommit.length): the input
      // history holds the typed letters, not the committing space separator, so
      // a space word is "complete" at text.length. display includes a newline
      // commit, which is a required typed char.
      if (
        lastWordInputLength <
        (TestWords.words.get(wordIndex)?.display.length ?? 0)
      ) {
        historyLength--;
      }

      const newProgress =
        CustomText.getCustomTextLongProgress(customTextName) + historyLength;
      CustomText.setCustomTextLongProgress(customTextName, newProgress);
      showSuccessNotification("Long custom text progress saved", {
        durationMs: 5000,
        important: true,
      });

      let newText = CustomText.getCustomText(customTextName, true);
      newText = newText.slice(newProgress);
      CustomText.setText(newText);
    } else {
      // They finished the test
      CustomText.setCustomTextLongProgress(customTextName, 0);
      const text = CustomText.getCustomText(customTextName, true);
      CustomText.setText(text);
      showSuccessNotification("Long custom text completed", {
        durationMs: 5000,
        important: true,
      });
    }
  }

  TodayTracker.addSeconds(
    completedEvent.testDuration - completedEvent.afkDuration,
  );
  Result.updateTodayTracker();

  let savingResultPromise: ReturnType<typeof saveResult> =
    Promise.resolve(null);
  const user = getAuthenticatedUser();
  if (user !== null) {
    // logged in
    if (dontSave) {
      void AnalyticsController.log("testCompletedInvalid");
    } else {
      resetIncompleteTests();

      if (!completedEvent.bailedOut) {
        const challenge = await ChallengeContoller.verify(completedEvent);
        if (!lease.isCurrent()) return;
        if (challenge !== null) completedEvent.challenge = challenge;
      }

      completedEvent.uid = user.uid;

      savingResultPromise = saveResult(completedEvent, false);
      void savingResultPromise.then((response) => {
        if (response?.status === 200) {
          void AnalyticsController.log("testCompleted");
        }
      });
    }
  } else {
    // logged out
    void AnalyticsController.log("testCompletedNoLogin");
    if (!dontSave) {
      // if its valid save it for later
      setLastSignedOutResult(completedEvent);
    }
    dontSave = true;
  }

  const resultUpdatePromise = Result.update(
    completedEvent,
    difficultyFailed,
    failReason,
    afkDetected,
    isRepeated(),
    tooShort,
    getCurrentQuote(),
    dontSave,
  );

  await Promise.all([savingResultPromise, resultUpdatePromise]);
}
