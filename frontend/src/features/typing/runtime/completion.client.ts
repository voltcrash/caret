import * as TestUI from "./test-ui";

import {
  showNoticeNotification,
  showErrorNotification,
  showSuccessNotification,
} from "../../../ts/states/notifications";
import * as CustomText from "./custom-text";

import * as PaceCaret from "./pace-caret";
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
  pushIncompleteTest,
  resetIncompleteTests,
  setIsRepeated,
  setIsTestInvalid,
  setLastResult,
  getBailedOut,
  setLastSignedOutResult,
  setResultVisible,
  setTestActive,
} from "../../../ts/states/test";

import * as AnalyticsController from "../../../ts/controllers/analytics-controller";

import { getAuthenticatedUser } from "../../../ts/auth-client";

import {
  CompletedEvent,
  CompletedEventCustomText,
} from "@oxytype/schemas/results";

import { getMutableConfig } from "../../../ts/config/store";

import {
  getTestSession,
  cleanupData,
  logEventsDataToTheConsoleTable,
  forceReleaseAllKeys,
  buildEventLog,
} from "./events/data";
import { analyze, getAnalysis } from "../analysis.client";
type InvalidResultReason =
  | "inconsistent duration"
  | "failed"
  | "too short"
  | "afk"
  | "repeated"
  | "wpm"
  | "raw"
  | "accuracy";

import { isDevEnvironment } from "../../../ts/utils/env";

import { countInvalidResultFields } from "@oxytype/web-shared/result-fields";

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

export async function finish(
  difficultyFailed: boolean,
  lease: { isCurrent: () => boolean },
): Promise<void> {
  const resultReady = Promise.all([import("./result"), prepareResultScreen()]);

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
  const validity = analyze(eventLog, {
    op: "validity",
    input: {
      result: completedEvent,
      bailedOut: getBailedOut(),
      failed: difficultyFailed,
      repeated: isRepeated(),
      lbOptOut: DB.getSnapshot()?.lbOptOut === true,
      customLimit: CustomText.getData().limit,
    },
  });
  const afkDetected = validity.afk;
  const invalidReason = validity.reason as InvalidResultReason | null;
  const tooShort = invalidReason === "too short";
  if (invalidReason === "failed") {
    showNoticeNotification(`Test failed - ${failReason}`, {
      durationMs: 1000,
    });
    dontSave = true;
  } else if (invalidReason !== null) {
    if (invalidReason === "inconsistent duration") {
      console.error(
        "Test duration inconsistent",
        ce.testDuration,
        getAnalysis(eventLog).dateDurationMs / 1000,
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
        seconds: getAnalysis(eventLog).incompleteTestSeconds,
      });
    }
  }

  const customTextName = getCustomTextIndicator()?.name ?? "";
  const isLong = getCustomTextIndicator()?.isLong === true;
  if (getMutableConfig().mode === "custom" && customTextName !== "" && isLong) {
    const { progress } = analyze(eventLog, {
      op: "customProgress",
      previous: CustomText.getCustomTextLongProgress(customTextName),
    });
    CustomText.setCustomTextLongProgress(customTextName, progress.progress);
    const text = CustomText.getCustomText(customTextName, true);
    CustomText.setText(text.slice(progress.progress));
    showSuccessNotification(
      progress.completed
        ? "Long custom text completed"
        : "Long custom text progress saved",
      {
        durationMs: 5000,
        important: true,
      },
    );
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
