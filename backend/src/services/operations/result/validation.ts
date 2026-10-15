import { clientProfile } from "../../../db/client-profile";

import * as ResultDAL from "../../../dal/result";

import { omit } from "../../../utils/misc";
import objectHash from "object-hash";
import Logger from "../../../utils/logger";

import MonkeyError from "../../../utils/error";
import { isTestTooShort } from "../../../utils/validation";
import {
  getResultFailure,
  getKeyDataFailure,
  getBotFailure,
  getTimingFingerprint,
} from "../../../anticheat/index";
import MonkeyStatusCodes from "../../../constants/monkey-status-codes";
import { purgeUserFromDailyLeaderboards } from "../../../utils/daily-leaderboards";
import * as UserDAL from "../../../dal/user";
import { buildMonkeyMail } from "../../../utils/monkey-mail";
import * as WeeklyXpLeaderboard from "../../../services/weekly-xp-leaderboard";

import { addImportantLog, addLog } from "../../../dal/logs";
import { AddResultRequest } from "@oxytype/contracts/results";
import { KeyStats } from "@oxytype/schemas/results";
import { isSafeNumber, roundTo2, stdDev } from "@oxytype/util/numbers";

import type { ServiceContext, OperationInput } from "../../context";
import { checkCompatibility } from "@oxytype/funbox";
import { tryCatch } from "@oxytype/util/trycatch";

import type { ValidatedSubmission } from "./context";
export async function validateSubmission(
  context: ServiceContext,
  input: OperationInput<undefined, AddResultRequest>,
): Promise<ValidatedSubmission | MonkeyError> {
  const { uid } = context.actor;

  // Independent of the user row; read both in one round trip.
  const lastResultTimestampRead = tryCatch(
    ResultDAL.getLastResultTimestamp(uid, input.body.result.client),
  );
  const user = await UserDAL.getUser(uid, "add result");

  if (user.needsToChangeName) {
    throw new MonkeyError(
      403,
      "Please change your name before submitting a result",
    );
  }

  // Each optimistic retry starts from the original client payload/hash.
  const completedEvent = structuredClone(input.body.result);
  completedEvent.uid = uid;
  const profile = clientProfile(user, completedEvent.client);
  const offline = completedEvent.offline === true;
  if (
    offline &&
    (completedEvent.timestamp < Date.now() - 30 * 86400000 ||
      completedEvent.timestamp > Date.now() + 1000)
  ) {
    throw new MonkeyError(
      400,
      "Offline results must be within the last 30 days",
    );
  }

  if (isTestTooShort(completedEvent)) {
    const status = MonkeyStatusCodes.TEST_TOO_SHORT;
    throw new MonkeyError(status.code, status.message);
  }

  if (user.lbOptOut !== true && completedEvent.acc < 75) {
    throw new MonkeyError(400, "Accuracy too low");
  }

  const resulthash = completedEvent.hash;
  const objectToHash = omit(completedEvent, ["hash"]);
  // Transport state changes on reconnect; submission identity must not.
  // Compute before server timestamps and anticheat normalization mutate it.
  const submissionHash = objectHash(omit(objectToHash, ["offline"]));
  if (context.configuration.results.objectHashCheckEnabled) {
    const serverhash = objectHash(objectToHash);
    // Older web clients hashed before the client discriminator existed.
    const legacyWebHash =
      completedEvent.client === "web"
        ? objectHash(omit(objectToHash, ["client"]))
        : undefined;
    if (serverhash !== resulthash && legacyWebHash !== resulthash) {
      await addLog(
        "incorrect_result_hash",
        {
          serverhash,
          resulthash,
          result: completedEvent,
        },
        uid,
      );
      const status = MonkeyStatusCodes.RESULT_HASH_INVALID;
      return new MonkeyError(status.code, "Incorrect result hash");
    }
  } else {
    Logger.warning("Object hash check is disabled, skipping hash check");
  }

  // Retained queues may retry results saved before stable hashes were deployed.
  // Match their original online/offline payload hashes too, before progression.
  if (
    await ResultDAL.hasSubmissionHash(uid, [
      submissionHash,
      resulthash,
      objectHash({ ...objectToHash, offline: false }),
      objectHash({ ...objectToHash, offline: true }),
    ])
  ) {
    const status = MonkeyStatusCodes.DUPLICATE_RESULT;
    throw new MonkeyError(status.code, "Duplicate result");
  }

  if (completedEvent.funbox.length !== new Set(completedEvent.funbox).size) {
    throw new MonkeyError(400, "Duplicate funboxes");
  }

  if (!checkCompatibility(completedEvent.funbox)) {
    throw new MonkeyError(400, "Impossible funbox combination");
  }

  let keySpacingStats: KeyStats | undefined = undefined;
  if (
    completedEvent.keySpacing !== "toolong" &&
    completedEvent.keySpacing.length > 0
  ) {
    keySpacingStats = {
      average:
        completedEvent.keySpacing.reduce(
          (previous, current) => (current += previous),
        ) / completedEvent.keySpacing.length,
      sd: stdDev(completedEvent.keySpacing),
    };
  }

  let keyDurationStats: KeyStats | undefined = undefined;
  if (
    completedEvent.keyDuration !== "toolong" &&
    completedEvent.keyDuration.length > 0
  ) {
    keyDurationStats = {
      average:
        completedEvent.keyDuration.reduce(
          (previous, current) => (current += previous),
        ) / completedEvent.keyDuration.length,
      sd: stdDev(completedEvent.keyDuration),
    };
  }

  if (user.suspicious && completedEvent.testDuration <= 120) {
    await addImportantLog("suspicious_user_result", completedEvent, uid);
  }

  if (
    completedEvent.mode === "time" &&
    (completedEvent.mode2 === "60" || completedEvent.mode2 === "15") &&
    completedEvent.wpm > 250 &&
    user.lbOptOut !== true
  ) {
    await addImportantLog("highwpm_user_result", completedEvent, uid);
  }

  const resultFailure =
    getResultFailure(completedEvent) ?? getKeyDataFailure(completedEvent);
  if (resultFailure !== undefined) {
    await addImportantLog(
      "anticheat_rejected",
      {
        reason: resultFailure,
        submissionHash: resulthash,
        mode: completedEvent.mode,
        mode2: completedEvent.mode2,
      },
      uid,
    );
    const status = MonkeyStatusCodes.RESULT_DATA_INVALID;
    return new MonkeyError(status.code, "Result data doesn't make sense");
  }

  //dont use - result timestamp is unreliable, can be changed by system time and stuff
  // if (result.timestamp > Math.round(Date.now() / 1000) * 1000 + 10) {
  //   log(
  //     "time_traveler",
  //     {
  //       resultTimestamp: result.timestamp,
  //       serverTimestamp: Math.round(Date.now() / 1000) * 1000 + 10,
  //     },
  //     uid
  //   );
  //   return res.status(400).json({ message: "Time traveler detected" });

  const { data: lastResultTimestamp, error: lastResultError } =
    await lastResultTimestampRead;
  // An unavailable database must not be interpreted as an empty result history.
  if (
    lastResultError &&
    !(lastResultError instanceof MonkeyError && lastResultError.status === 404)
  ) {
    throw lastResultError;
  }

  // Abandoned-test time (incompleteTestSeconds/incompleteTests) is client
  // supplied. When a previous result exists it is bounded to real elapsed time
  // by the result-spacing check below. When it does not (new account, or all
  // results deleted) there is nothing to bound it against, so it must not be
  // credited toward timeTyping / XP / leaderboard eligibility.
  if (offline || !isSafeNumber(lastResultTimestamp)) {
    completedEvent.incompleteTestSeconds = 0;
    completedEvent.incompleteTests = [];
    if (offline) completedEvent.restartCount = 0;
  }

  //convert result test duration to miliseconds
  if (!offline) completedEvent.timestamp = Math.floor(Date.now() / 1000) * 1000;

  //check if now is earlier than last result plus duration (-1 second as a buffer)
  const testDurationMilis = completedEvent.testDuration * 1000;
  const incompleteTestsMilis = completedEvent.incompleteTestSeconds * 1000;
  // New-account first saves are bounded by a server timestamp too. Legacy
  // imports without a creation time retain the epoch fallback; client result
  // timestamps never establish the window.
  const previousTimestamp =
    lastResultTimestamp ?? (isSafeNumber(user.addedAt) ? user.addedAt : 0);
  const earliestPossible =
    previousTimestamp + testDurationMilis + incompleteTestsMilis;
  const nowNoMilis = Math.floor(Date.now() / 1000) * 1000;
  if (!offline && nowNoMilis < earliestPossible - 1000) {
    await addLog(
      "invalid_result_spacing",
      {
        lastTimestamp: lastResultTimestamp,
        accountCreatedAt: user.addedAt,
        earliestPossible,
        now: nowNoMilis,
        testDuration: testDurationMilis,
        difference: nowNoMilis - earliestPossible,
      },
      uid,
    );
    const status = MonkeyStatusCodes.RESULT_SPACING_INVALID;
    return new MonkeyError(status.code, "Invalid result spacing");
  }

  //check keyspacing and duration here for bots
  if (
    completedEvent.mode === "time" &&
    completedEvent.wpm > context.configuration.anticheat.botCheckMinWpm &&
    completedEvent.testDuration < 122 &&
    (user.verified === false || user.verified === undefined) &&
    user.lbOptOut !== true
  ) {
    if (!keySpacingStats || !keyDurationStats) {
      await addImportantLog(
        "anticheat_rejected",
        {
          reason: "missing-key-data",
          submissionHash: resulthash,
        },
        uid,
      );
      const status = MonkeyStatusCodes.MISSING_KEY_DATA;
      return new MonkeyError(status.code, "Missing key data");
    }
    if (completedEvent.keyOverlap === undefined) {
      throw new MonkeyError(400, "Old key data format");
    }
    const botFailure = getBotFailure(completedEvent);
    if (botFailure !== undefined) {
      await addImportantLog(
        "anticheat_rejected",
        {
          reason: botFailure,
          submissionHash: resulthash,
        },
        uid,
      );
      //autoban
      const autoBanConfig = context.configuration.users.autoBan;
      if (autoBanConfig.enabled) {
        const didUserGetBanned = await UserDAL.recordAutoBanEvent(
          uid,
          autoBanConfig.maxCount,
          autoBanConfig.maxHours,
        );
        if (didUserGetBanned) {
          const mail = buildMonkeyMail({
            subject: "Banned",
            body: "Your account has been automatically banned for triggering the anticheat system. If you believe this is a mistake, please contact support.",
          });
          await Promise.all([
            UserDAL.addToInbox(uid, [mail], context.configuration.users.inbox),
            purgeUserFromDailyLeaderboards(
              uid,
              context.configuration.dailyLeaderboards,
            ),
            WeeklyXpLeaderboard.purgeUserFromXpLeaderboards(
              uid,
              context.configuration.leaderboards.weeklyXp,
            ),
          ]);
          user.banned = true;
        }
      }
      const status = MonkeyStatusCodes.BOT_DETECTED;
      return new MonkeyError(status.code, "Possible bot detected");
    }
  }

  const replayCheck = context.configuration.anticheat.replayCheck;
  const timingHash = replayCheck.enabled
    ? getTimingFingerprint(completedEvent)
    : undefined;
  if (timingHash !== undefined) {
    const lastTimingHashes = user.lastTimingHashes ?? [];
    if (lastTimingHashes.includes(timingHash)) {
      await addImportantLog(
        "anticheat_rejected",
        {
          reason: "replayed-key-timing",
          submissionHash: resulthash,
          mode: completedEvent.mode,
          mode2: completedEvent.mode2,
        },
        uid,
      );
      const status = MonkeyStatusCodes.DUPLICATE_RESULT;
      return new MonkeyError(status.code, "Duplicate result");
    }
    await UserDAL.updateLastTimingHashes(
      uid,
      [timingHash, ...lastTimingHashes].slice(0, replayCheck.maxFingerprints),
    );
  }

  if (keyDurationStats) {
    keyDurationStats.average = roundTo2(keyDurationStats.average);
    keyDurationStats.sd = roundTo2(keyDurationStats.sd);
  }
  if (keySpacingStats) {
    keySpacingStats.average = roundTo2(keySpacingStats.average);
    keySpacingStats.sd = roundTo2(keySpacingStats.sd);
  }

  return {
    context,
    input,
    uid,
    user,
    completedEvent,
    profile,
    offline,
    resulthash,
    submissionHash,
    lastResultTimestamp,
    keySpacingStats,
    keyDurationStats,
  };
}
