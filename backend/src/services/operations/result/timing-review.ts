import { getTimingReview } from "../../../anticheat/index";

import * as UserDAL from "../../../dal/user";

import { Configuration } from "@oxytype/schemas/configuration";
import { addImportantLog, addLog, countUserLogs } from "../../../dal/logs";

import { CompletedEvent } from "@oxytype/schemas/results";

/**
 * Log-only review of a saved result. Signals are uncalibrated, so they are
 * written for review and calibration and never reject, strike or ban.
 */
export async function reviewKeyTiming(
  completedEvent: CompletedEvent,
  context: {
    resultId: string;
    submissionHash: string;
    verified: boolean;
    lbOptOut: boolean;
    suspicious: boolean;
  },
  { review, samples }: Configuration["anticheat"],
): Promise<void> {
  if (!review.enabled || completedEvent.wpm < review.minWpm) return;
  const timing = getTimingReview(completedEvent);
  if (timing === undefined) return;

  const summary = {
    ...context,
    client: completedEvent.client,
    offline: completedEvent.offline === true,
    mode: completedEvent.mode,
    mode2: completedEvent.mode2,
    wpm: completedEvent.wpm,
    testDuration: completedEvent.testDuration,
    signals: timing.signals,
  };
  const flagged = timing.signals.length > 0;
  if (flagged) {
    await addImportantLog(
      "anticheat_flagged",
      { ...summary, features: timing.features },
      completedEvent.uid,
    );
    await escalateRepeatedFlags(completedEvent.uid, context.suspicious, review);
  }
  if (
    (flagged && samples.captureFlagged) ||
    Math.random() < samples.randomRate
  ) {
    await addLog(
      "anticheat_sample",
      {
        ...summary,
        keySpacing: completedEvent.keySpacing,
        keyDuration: completedEvent.keyDuration,
      },
      completedEvent.uid,
    );
  }
}

/**
 * Repeated flags only raise review: suspicious users get every short result
 * logged. It never limits the account; admins decide from the evidence.
 */
async function escalateRepeatedFlags(
  uid: string,
  suspicious: boolean,
  review: Configuration["anticheat"]["review"],
): Promise<void> {
  if (suspicious || review.suspiciousAfterFlags === 0) return;
  const since = Date.now() - review.suspiciousWindowHours * 60 * 60 * 1000;
  // the flag just staged is not visible until the batch commits
  const flags = (await countUserLogs(uid, "anticheat_flagged", since)) + 1;
  if (flags < review.suspiciousAfterFlags) return;
  await UserDAL.setSuspicious(uid);
  await addImportantLog("anticheat_marked_suspicious", { flags }, uid);
}
