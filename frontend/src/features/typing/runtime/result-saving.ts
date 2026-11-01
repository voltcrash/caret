import { captureAccount, createAccountOwned } from "../../../app/account-scope";
import { appObject } from "../../../app/state";
import { captureTypingRoute } from "../scope";
import { operation } from "../../../data/operations";
import {
  pendingResultSaves,
  trackResultSave,
} from "../../../app/update-safety";
import { resultOutbox } from "../result-outbox.client";
import type { OperationResponse } from "../../../data/operation-types";
import type { OperationResult } from "../../../data/operation-result";

import {
  showNoticeNotification,
  showErrorNotification,
  showSuccessNotification,
} from "../../../ts/states/notifications";

import * as DB from "../../../ts/db";

import { getResultVisible } from "../../../ts/states/test";

import { hashResult } from "../../../ts/utils/result-hash";

import { CompletedEvent } from "@caret/schemas/results";
import type { WebLog } from "@caret/typing-engine/text";
import { encodeEventLog } from "./event-log-transport";

import { SavedResult } from "../../../ts/constants/default-snapshot";

import { setAccountButtonSpinner } from "../../../ts/states/header";
import { getMutableConfig } from "../../../ts/config/store";

const getRetrySavingState = createAccountOwned<RetrySaving>(() => ({
  completedEvent: null,
  eventLog: null,
  canRetry: false,
  draining: false,
}));
const retrySavingState = appObject(getRetrySavingState);
type RetrySaving = {
  completedEvent: CompletedEvent | null;
  eventLog: WebLog | null;
  canRetry: boolean;
  draining: boolean;
};

function isPermanentFailure(status: number): boolean {
  return [400, 422, 460, 461, 463, 464, 465, 466].includes(status);
}

export async function retrySavingResult(): Promise<void> {
  const account = captureAccount();
  const queue = resultOutbox();
  const state = getRetrySavingState();
  if (state.draining || pendingResultSaves() > 0) return;
  state.draining = true;
  try {
    await queue.load();
    for (const entry of queue.entries()) {
      if (!account.isCurrent()) return;
      // The current test keeps its original online eligibility on retry.
      if (state.canRetry && entry.result.hash === state.completedEvent?.hash)
        continue;
      const response = await saveResult(
        { ...entry.result, offline: true },
        true,
        entry.eventLog,
        entry.result.hash,
      );
      if (
        response === null ||
        (!response.ok && !isPermanentFailure(response.status))
      )
        return;
    }
  } finally {
    state.draining = false;
  }
  if (!account.isCurrent()) return;
  if (queue.entries().length === 0 && state.completedEvent === null) return;
  const { completedEvent, eventLog } = retrySavingState;

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
  if (!account.isCurrent()) return;
  Result.updateRetrySaving(false);

  showNoticeNotification("Retrying to save...");

  await saveResult(completedEvent, true, eventLog ?? undefined);
}

/** `eventLog` is the log the result was scored from; the server replays it. */
export async function saveResult(
  completedEvent: CompletedEvent,
  isRetrying: boolean,
  eventLog?: WebLog,
  queuedHash?: string,
): Promise<null | OperationResult<OperationResponse<"results.add">>> {
  return await trackResultSave(
    saveResultInternal(completedEvent, isRetrying, eventLog, queuedHash),
  );
}

async function saveResultInternal(
  completedEvent: CompletedEvent,
  isRetrying: boolean,
  eventLog?: WebLog,
  queuedHash?: string,
): Promise<null | OperationResult<OperationResponse<"results.add">>> {
  const account = captureAccount();
  const presentation =
    queuedHash === undefined
      ? captureTypingRoute()
      : { isCurrent: () => false };
  const queue = resultOutbox();
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
  const pendingHash = queuedHash ?? result.hash;
  if (!isRetrying) {
    // A newer completion owns the live retry slot; earlier work remains in
    // the durable queue and follows historical/offline submission rules.
    retrySavingState.completedEvent = null;
    retrySavingState.eventLog = null;
    retrySavingState.canRetry = false;
    try {
      await queue.add({
        result,
        ...(eventLog === undefined ? {} : { eventLog }),
      });
    } catch {
      showNoticeNotification(
        "Browser storage unavailable: keep this tab open until the result saves.",
      );
    }
  }
  const encodedLog =
    eventLog === undefined ? undefined : await encodeEventLog(eventLog, result);
  if (!account.isCurrent()) return null;

  setAccountButtonSpinner(true);

  let response: OperationResult<OperationResponse<"results.add">>;
  try {
    response = await operation("results.add", {
      body:
        encodedLog === undefined
          ? { result, acknowledgeDuplicate: true }
          : { result, eventLog: encodedLog, acknowledgeDuplicate: true },
    });
  } catch (error) {
    if (!account.isCurrent()) return null;
    throw error;
  }
  const Result = await import("./result");
  if (!account.isCurrent()) return response;

  setAccountButtonSpinner(false);

  if (!response.ok) {
    if (isPermanentFailure(response.status)) {
      await queue.remove(pendingHash).catch(() => undefined);
      if (retrySavingState.completedEvent?.hash === pendingHash) {
        retrySavingState.completedEvent = null;
        retrySavingState.eventLog = null;
        retrySavingState.canRetry = false;
      }
    }
    //only allow retry if status is not in this list
    if (!isPermanentFailure(response.status)) {
      retrySavingState.canRetry = true;
      if (presentation.isCurrent()) Result.updateRetrySaving(true);
      if (!isRetrying) {
        retrySavingState.completedEvent = result;
        retrySavingState.eventLog = eventLog ?? null;
      }
    }
    console.log("Error saving result", result);
    if (response.message === "Old key data format") {
      response.message =
        "Old key data format. Please refresh the page to download the new update. If the problem persists, please contact support.";
    }
    if (/"result\..+" is (not allowed|required)/gi.test(response.message)) {
      response.message =
        "Looks like your result data is using an incorrect schema. Please refresh the page to download the new update. If the problem persists, please contact support.";
    }
    showErrorNotification("Failed to save result", { operation: response });
    return response;
  }

  const data = response.data;
  await queue.remove(pendingHash).catch(() => undefined);
  if (retrySavingState.completedEvent?.hash === pendingHash) {
    retrySavingState.completedEvent = null;
    retrySavingState.eventLog = null;
    retrySavingState.canRetry = false;
  }
  if (presentation.isCurrent()) Result.updateSavedResultId(data.insertedId);
  if (data.alreadySaved) {
    await Promise.all([
      DB.initSnapshot(),
      (await import("../../../ts/collections/results")).refetchResults(),
    ]);
    return response;
  }

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
      verification: data.verification,
    });
    if (data.isPb !== undefined && data.isPb) {
      snapshotResult.isPb = true;
    }
    localDataToSave.result = snapshotResult;
  }

  if (data.isPb !== undefined && data.isPb) {
    // The server compares the matching settings; the local PB cache may be empty.
    if (presentation.isCurrent()) {
      void Result.showConfetti();
      Result.showCrown("normal");
    }

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

export async function discardPendingResults(): Promise<void> {
  await resultOutbox().clear();
  retrySavingState.completedEvent = null;
  retrySavingState.eventLog = null;
  retrySavingState.canRetry = false;
  (await import("./result")).updateRetrySaving(false);
}
