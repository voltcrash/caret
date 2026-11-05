import type { CompletionSnapshot } from "./completion-snapshot";

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

import {
  setLastEventLog,
  pushIncompleteTest,
  resetIncompleteTests,
  setIsRepeated,
  setIsTestInvalid,
  setLastResult,
  setLastSignedOutResult,
} from "../../../ts/states/test";

import * as AnalyticsController from "../../../ts/controllers/analytics-controller";

import {
  CompletedEvent,
  CompletedEventCustomText,
} from "@caret/schemas/results";

import { getTestSession } from "./events/data";
import {
  analyze,
  getAnalysis,
  getMissedWords,
  getWordBurstHistory,
} from "../analysis.client";
import { practiceHistory } from "../practice-history.client";
type InvalidResultReason =
  | "inconsistent duration"
  | "failed"
  | "too short"
  | "afk"
  | "repeated"
  | "wpm"
  | "raw"
  | "accuracy";

import { countInvalidResultFields } from "@caret/web-shared/result-fields";

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

export function createCompletion(
  snapshot: CompletionSnapshot,
  difficultyFailed: boolean,
): {
  build: (lease: { isCurrent: () => boolean }) => Promise<void>;
  present: (lease: { isCurrent: () => boolean }) => Promise<void>;
  saved: () => Promise<void>;
} {
  let presentation:
    | (() => [
        CompletedEvent,
        boolean,
        string,
        boolean,
        boolean,
        boolean,
        CompletionSnapshot["quote"],
        boolean,
      ])
    | undefined;
  let saving: Promise<unknown> = Promise.resolve();
  const effects = new Set<string>();
  const once = (key: string, run: () => void): void => {
    if (effects.has(key)) return;
    try {
      run();
      effects.add(key);
    } catch (error) {
      showErrorNotification("Could not update test progress", { error });
    }
  };
  const build = async (lease: { isCurrent: () => boolean }): Promise<void> => {
    if (presentation !== undefined) return;
    const {
      eventLog,
      config,
      quote,
      customText,
      repeated,
      bailedOut,
      failReason,
      words,
      user,
    } = snapshot;
    const Result = await import("./result");
    if (!lease.isCurrent()) return;
    once("saveState", Result.resetResultSaveState);
    const tags =
      user !== null && snapshot.account.isCurrent()
        ? (await import("../../../ts/collections/tags"))
            .getActiveTags()
            .map((tag) => tag._id)
        : [];
    if (!lease.isCurrent()) return;
    const completedCustomText: CompletedEventCustomText | undefined =
      config.mode === "custom"
        ? {
            textLen: customText.text.length,
            mode: customText.mode,
            pipeDelimiter: customText.pipeDelimiter,
            limit: customText.limit,
          }
        : undefined;
    const ce = getTestSession().complete(eventLog, {
      config,
      currentQuote: quote,
      customText: completedCustomText,
      tags,
      bailedOut,
      restartCount: snapshot.restartCount,
      incompleteTests: snapshot.incompleteTests,
      incompleteSeconds: snapshot.incompleteSeconds,
      timestamp: snapshot.timestamp,
    });
    once("pace", () => PaceCaret.setLastTestWpm(ce.wpm));

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

    once("lastResult", () => {
      setLastEventLog(eventLog);
      setLastResult(structuredClone(completedEvent));
      setIsRepeated(repeated);
    });

    ///////// completed event ready

    const validity = analyze(eventLog, {
      op: "validity",
      input: {
        result: completedEvent,
        bailedOut,
        failed: difficultyFailed,
        repeated: repeated,
        lbOptOut: DB.getSnapshot()?.lbOptOut === true,
        customLimit: customText.limit,
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
      showNoticeNotification(
        `Test invalid - ${invalidMessages[invalidReason]}`,
      );
      setIsTestInvalid(true);
      dontSave = true;
    }

    // test is valid

    if (repeated || difficultyFailed) {
      if (config.resultSaving) {
        once("incomplete", () =>
          pushIncompleteTest({
            acc: completedEvent.acc,
            seconds: getAnalysis(eventLog).incompleteTestSeconds,
          }),
        );
      }
    }

    const customTextName = snapshot.customIndicator?.name ?? "";
    // Ordinary generated text and our own drills only: never persist arbitrary
    // custom/zen text into the learning model.
    if (
      !dontSave &&
      (["time", "words", "quote"].includes(config.mode) ||
        customTextName === "practice")
    ) {
      once("practice", () =>
        practiceHistory().record(
          `${config.language}:${config.layout}`,
          words.slice(0, getAnalysis(eventLog).inputHistory.length),
          getMissedWords(eventLog),
          getWordBurstHistory(eventLog),
          completedEvent.testDuration - completedEvent.afkDuration,
        ),
      );
    }
    const isLong = snapshot.customIndicator?.isLong === true;
    if (config.mode === "custom" && customTextName !== "" && isLong) {
      once("longText", () => {
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
      });
    }

    once("today", () =>
      TodayTracker.addSeconds(
        completedEvent.testDuration - completedEvent.afkDuration,
      ),
    );
    Result.updateTodayTracker();

    if (user !== null) {
      // logged in
      if (dontSave) {
        void AnalyticsController.log("testCompletedInvalid");
      } else {
        once("resetIncomplete", resetIncompleteTests);

        if (!completedEvent.bailedOut) {
          const challenge = await ChallengeContoller.verify(
            completedEvent,
            config,
          );
          if (!lease.isCurrent()) return;
          if (challenge !== null) completedEvent.challenge = challenge;
        }

        completedEvent.uid = user.uid;

        if (snapshot.account.isCurrent()) {
          once("save", () => {
            saving = saveResult(completedEvent, false, eventLog)
              .then((response) => {
                if (response?.status === 200) {
                  void AnalyticsController.log("testCompleted");
                }
                return undefined;
              })
              .catch((error: unknown) =>
                console.error("Result save failed", error),
              );
          });
        }
      }
    } else {
      // logged out
      void AnalyticsController.log("testCompletedNoLogin");
      if (!dontSave) {
        // if its valid save it for later
        once("signedOut", () => setLastSignedOutResult(completedEvent));
      }
      dontSave = true;
    }

    presentation = () => [
      completedEvent,
      difficultyFailed,
      failReason,
      afkDetected,
      repeated,
      tooShort,
      quote,
      dontSave,
    ];
  };
  return {
    build,
    present: async (lease: { isCurrent: () => boolean }): Promise<void> => {
      if (presentation === undefined) throw new Error("Result is not built");
      const Result = await import("./result");
      if (!lease.isCurrent()) return;
      await Result.update(...presentation(), lease);
    },
    saved: async (): Promise<void> => {
      await saving;
    },
  };
}
