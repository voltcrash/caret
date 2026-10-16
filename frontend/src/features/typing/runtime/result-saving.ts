import { captureAccount, createAccountOwned } from "../../../app/account-scope";
import { appObject } from "../../../app/state";
import { captureTypingRoute } from "../scope";
import Ape from "../../../ts/ape";

import {
  showNoticeNotification,
  showErrorNotification,
  showSuccessNotification,
} from "../../../ts/states/notifications";

import * as DB from "../../../ts/db";

import { getResultVisible } from "../../../ts/states/test";

import { hashResult } from "../../../ts/utils/result-hash";

import { CompletedEvent } from "@oxytype/schemas/results";

import { getFunbox } from "@oxytype/funbox";

import { SavedResult } from "../../../ts/constants/default-snapshot";

import { setAccountButtonSpinner } from "../../../ts/states/header";
import { getMutableConfig } from "../../../ts/config/store";

const retrySavingState = appObject(
  createAccountOwned<RetrySaving>(() => ({
    completedEvent: null,
    canRetry: false,
  })),
);
type RetrySaving = {
  completedEvent: CompletedEvent | null;
  canRetry: boolean;
};

export async function retrySavingResult(): Promise<void> {
  const { completedEvent } = retrySavingState;

  if (completedEvent === null) {
    showNoticeNotification(
      "Could not retry saving the result as the result no longer exists.",
      {
        durationMs: 5000,
        important: true,
      },
    );

    return;
  }

  if (!retrySavingState.canRetry) {
    return;
  }

  retrySavingState.canRetry = false;
  const Result = await import("./result");
  Result.updateRetrySaving(false);

  showNoticeNotification("Retrying to save...");

  await saveResult(completedEvent, true);
}

export async function saveResult(
  completedEvent: CompletedEvent,
  isRetrying: boolean,
): Promise<null | Awaited<ReturnType<typeof Ape.results.add>>> {
  const account = captureAccount();
  const presentation = captureTypingRoute();
  if (!getMutableConfig().resultSaving) {
    showErrorNotification("Result not saved: disabled by user", {
      durationMs: 3000,
      customTitle: "Notice",
      important: true,
    });
    return null;
  }

  const result = structuredClone(completedEvent);

  if (result.testDuration > 122) {
    result.chartData = "toolong";
    result.keySpacing = "toolong";
    result.keyDuration = "toolong";
  }
  const unhashed: Omit<CompletedEvent, "hash"> & { hash?: string } = result;
  delete unhashed.hash;
  result.hash = await hashResult(result);
  if (!account.isCurrent()) return null;

  setAccountButtonSpinner(true);

  const response = await Ape.results.add({ body: { result } });
  const Result = await import("./result");
  if (!account.isCurrent()) return response;

  setAccountButtonSpinner(false);

  if (response.status !== 200) {
    //only allow retry if status is not in this list
    if (![460, 461, 463, 464, 465, 466].includes(response.status)) {
      retrySavingState.canRetry = true;
      if (presentation.isCurrent()) Result.updateRetrySaving(true);
      if (!isRetrying) {
        retrySavingState.completedEvent = result;
      }
    }
    console.log("Error saving result", result);
    if (response.body.message === "Old key data format") {
      response.body.message =
        "Old key data format. Please refresh the page to download the new update. If the problem persists, please contact support.";
    }
    if (
      /"result\..+" is (not allowed|required)/gi.test(response.body.message)
    ) {
      response.body.message =
        "Looks like your result data is using an incorrect schema. Please refresh the page to download the new update. If the problem persists, please contact support.";
    }
    showErrorNotification("Failed to save result", { response });
    return response;
  }

  const data = response.body.data;
  if (presentation.isCurrent()) Result.updateSavedResultId(data.insertedId);

  const localDataToSave: DB.SaveLocalResultData = {};

  if (data.xp !== undefined) {
    localDataToSave.xp = data.xp;
    if (presentation.isCurrent() && getResultVisible()) {
      localDataToSave.xpBreakdown = data.xpBreakdown;
    }
  }

  if (data.streak !== undefined) {
    localDataToSave.streak = data.streak;
  }

  if (data.insertedId !== undefined) {
    const snapshotResult: SavedResult = Object.assign(structuredClone(result), {
      _id: data.insertedId,
    });
    if (data.isPb !== undefined && data.isPb) {
      snapshotResult.isPb = true;
    }
    localDataToSave.result = snapshotResult;
  }

  if (data.isPb !== undefined && data.isPb) {
    //new pb
    const localPb = DB.getLocalPB(
      result.mode,
      result.mode2,
      result.punctuation,
      result.numbers,
      result.language,
      result.difficulty,
      result.lazyMode,
      getFunbox(result.funbox),
    );

    if (presentation.isCurrent() && localPb !== undefined) {
      void Result.showConfetti();
    }
    if (presentation.isCurrent()) Result.showCrown("normal");

    localDataToSave.isPb = true;
  } else if (presentation.isCurrent()) {
    Result.showErrorCrownIfNeeded();
  }

  if (presentation.isCurrent()) {
    Result.updateDailyLeaderboardRank(data.dailyLeaderboardRank);
    Result.updateRetrySaving(false);
  }
  if (isRetrying) {
    showSuccessNotification("Result saved", { important: true });
  }
  DB.saveLocalResult(localDataToSave);
  return response;
}
