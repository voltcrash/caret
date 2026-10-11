import { clientProfile } from "../../db/client-profile";
import type { ClientQuery } from "@oxytype/schemas/shared";
import { isUniqueViolation } from "../../db/client";
import { atomicUser } from "../../db/mutation";
import * as ResultDAL from "../../dal/result";
import * as PublicDAL from "../../dal/public";
import { isDevEnvironment, omit } from "../../utils/misc";
import objectHash from "object-hash";
import Logger from "../../utils/logger";
import { MonkeyResponse } from "../../utils/monkey-response";
import MonkeyError from "../../utils/error";
import { isTestTooShort } from "../../utils/validation";
import {
  getResultFailure,
  getKeyDataFailure,
  getBotFailure,
  getTimingReview,
  getTimingFingerprint,
} from "../../anticheat/index";
import MonkeyStatusCodes from "../../constants/monkey-status-codes";
import {
  getDailyLeaderboard,
  purgeUserFromDailyLeaderboards,
} from "../../utils/daily-leaderboards";
import * as UserDAL from "../../dal/user";
import { buildMonkeyMail } from "../../utils/monkey-mail";
import * as WeeklyXpLeaderboard from "../../services/weekly-xp-leaderboard";
import { canFunboxGetPb } from "../../utils/pb";
import { buildDbResult } from "../../utils/result";
import { Configuration } from "@oxytype/schemas/configuration";
import { addImportantLog, addLog, countUserLogs } from "../../dal/logs";
import {
  AddResultRequest,
  AddResultResponse,
  GetLastResultResponse,
  GetResultByIdPath,
  GetResultByIdResponse,
  GetResultsQuery,
  GetResultsResponse,
  UpdateResultTagsRequest,
  UpdateResultTagsResponse,
} from "@oxytype/contracts/results";
import {
  CompletedEvent,
  KeyStats,
  PostResultResponse,
  XpBreakdown,
} from "@oxytype/schemas/results";
import {
  isSafeNumber,
  mapRange,
  roundTo2,
  stdDev,
} from "@oxytype/util/numbers";
import {
  getCurrentDayTimestamp,
  getStartOfDayTimestamp,
} from "@oxytype/util/date-and-time";
import { MonkeyRequest } from "../types";
import { getFunbox, checkCompatibility } from "@oxytype/funbox";
import { tryCatch } from "@oxytype/util/trycatch";
import { getCachedConfiguration } from "../../init/configuration";

export async function getResults(
  req: MonkeyRequest<GetResultsQuery>,
): Promise<GetResultsResponse> {
  const { uid } = req.ctx.decodedToken;
  const premiumFeaturesEnabled = req.ctx.configuration.users.premium.enabled;
  const { onOrAfterTimestamp = NaN, offset = 0 } = req.query;
  const userHasPremium = await UserDAL.checkIfUserIsPremium(uid);

  const maxLimit =
    premiumFeaturesEnabled && userHasPremium
      ? req.ctx.configuration.results.limits.premiumUser
      : req.ctx.configuration.results.limits.regularUser;

  let limit =
    req.query.limit ??
    Math.min(req.ctx.configuration.results.maxBatchSize, maxLimit);

  //check if premium features are disabled and current call exceeds the limit for regular users
  if (
    userHasPremium &&
    !premiumFeaturesEnabled &&
    limit + offset > req.ctx.configuration.results.limits.regularUser
  ) {
    throw new MonkeyError(503, "Premium feature disabled.");
  }

  if (limit + offset > maxLimit) {
    if (offset < maxLimit) {
      //batch is partly in the allowed ranged. Set the limit to the max allowed and return partly results.
      limit = maxLimit - offset;
    } else {
      throw new MonkeyError(422, `Max results limit of ${maxLimit} exceeded.`);
    }
  }

  const results = await ResultDAL.getResults(uid, {
    onOrAfterTimestamp,
    client: req.query.client,
    limit,
    offset,
  });
  await addLog(
    "user_results_requested",
    {
      limit,
      offset,
      onOrAfterTimestamp,
      isPremium: userHasPremium,
    },
    uid,
  );

  return new MonkeyResponse("Results retrieved", results);
}

export async function getResultById(
  req: MonkeyRequest<undefined, undefined, GetResultByIdPath>,
): Promise<GetResultByIdResponse> {
  const { uid } = req.ctx.decodedToken;
  const { resultId } = req.params;

  const result = await ResultDAL.getResult(uid, resultId);
  return new MonkeyResponse("Result retrieved", result);
}

export async function getLastResult(
  req: MonkeyRequest<ClientQuery>,
): Promise<GetLastResultResponse> {
  const { uid } = req.ctx.decodedToken;
  const result = await ResultDAL.getLastResult(uid, req.query?.client);
  return new MonkeyResponse("Result retrieved", result);
}

export async function updateTags(
  req: MonkeyRequest<undefined, UpdateResultTagsRequest>,
): Promise<UpdateResultTagsResponse> {
  const { uid } = req.ctx.decodedToken;
  const { tagIds, resultId } = req.body;

  return await atomicUser(uid, async () => {
    await ResultDAL.updateTags(uid, resultId, tagIds);
    const result = await ResultDAL.getResult(uid, resultId);

    result.tags = tagIds;
    result.difficulty ??= "normal";
    result.language ??= "english";
    result.funbox ??= [];
    result.lazyMode ??= false;
    result.punctuation ??= false;
    result.numbers ??= false;

    const user = await UserDAL.getPartialUser(uid, "update tags", ["tags"]);
    const tagPbs = await UserDAL.checkIfTagPb(uid, user, result);
    return new MonkeyResponse("Result tags updated", {
      tagPbs,
    });
  });
}

export async function addResult(
  req: MonkeyRequest<undefined, AddResultRequest>,
): Promise<AddResultResponse> {
  const uid = req.ctx.decodedToken.uid;
  const response = await atomicUser(
    uid,
    async () => await addResultAtomic(req),
  ).catch((error: unknown) => {
    if (isUniqueViolation(error)) {
      const status = MonkeyStatusCodes.DUPLICATE_RESULT;
      throw new MonkeyError(status.code, "Duplicate result");
    }
    throw error;
  });
  // Rejections before progression may commit their audit/strike writes. Throw
  // only after that batch succeeds; thrown errors inside atomicUser roll back.
  if (response instanceof MonkeyError) throw response;
  // Both ranks are read from committed data, so look them up together.
  await Promise.all([
    (async () => {
      if (response.data.dailyLeaderboardRank === undefined) return;
      const daily = getDailyLeaderboard(
        req.body.result.language,
        req.body.result.mode,
        req.body.result.mode2,
        req.ctx.configuration.dailyLeaderboards,
        -1,
        req.body.result.client,
      );
      const entry = await daily?.getRank(
        uid,
        req.ctx.configuration.dailyLeaderboards,
      );
      if (entry) response.data.dailyLeaderboardRank = entry.rank;
      else delete response.data.dailyLeaderboardRank;
    })(),
    (async () => {
      if (response.data.weeklyXpLeaderboardRank === undefined) return;
      const weekly = WeeklyXpLeaderboard.get(
        req.ctx.configuration.leaderboards.weeklyXp,
        undefined,
        req.body.result.client,
      );
      const entry = await weekly?.getRank(
        uid,
        req.ctx.configuration.leaderboards.weeklyXp,
      );
      if (entry) response.data.weeklyXpLeaderboardRank = entry.rank;
      else delete response.data.weeklyXpLeaderboardRank;
    })(),
  ]);
  return response;
}

async function addResultAtomic(
  req: MonkeyRequest<undefined, AddResultRequest>,
): Promise<AddResultResponse | MonkeyError> {
  const { uid } = req.ctx.decodedToken;

  // Independent of the user row; read both in one round trip.
  const lastResultTimestampRead = tryCatch(
    ResultDAL.getLastResultTimestamp(uid, req.body.result.client),
  );
  const user = await UserDAL.getUser(uid, "add result");

  if (user.needsToChangeName) {
    throw new MonkeyError(
      403,
      "Please change your name before submitting a result",
    );
  }

  // Each optimistic retry starts from the original client payload/hash.
  const completedEvent = structuredClone(req.body.result);
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
  // Transport state changes on reconnect; submission identity must not.
  // Compute before server timestamps and anticheat normalization mutate it.
  const submissionHash = objectHash(omit(completedEvent, ["hash", "offline"]));
  if (req.ctx.configuration.results.objectHashCheckEnabled) {
    const objectToHash = omit(completedEvent, ["hash"]);
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
    completedEvent.wpm > req.ctx.configuration.anticheat.botCheckMinWpm &&
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
      const autoBanConfig = req.ctx.configuration.users.autoBan;
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
            UserDAL.addToInbox(uid, [mail], req.ctx.configuration.users.inbox),
            purgeUserFromDailyLeaderboards(
              uid,
              req.ctx.configuration.dailyLeaderboards,
            ),
            WeeklyXpLeaderboard.purgeUserFromXpLeaderboards(
              uid,
              req.ctx.configuration.leaderboards.weeklyXp,
            ),
          ]);
          user.banned = true;
        }
      }
      const status = MonkeyStatusCodes.BOT_DETECTED;
      return new MonkeyError(status.code, "Possible bot detected");
    }
  }

  const replayCheck = req.ctx.configuration.anticheat.replayCheck;
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

  let isPb = false;
  let tagPbs: string[] = [];

  if (!offline && !completedEvent.bailedOut) {
    [isPb, tagPbs] = await Promise.all([
      UserDAL.checkIfPb(uid, user, completedEvent),
      UserDAL.checkIfTagPb(uid, user, completedEvent),
    ]);
  }

  if (
    !offline &&
    completedEvent.mode === "time" &&
    completedEvent.mode2 === "60"
  ) {
    await UserDAL.incrementBananas(
      uid,
      completedEvent.wpm,
      completedEvent.client,
    );
  }

  delete completedEvent.challenge;

  const afk = completedEvent.afkDuration ?? 0;
  const totalDurationTypedSeconds =
    completedEvent.testDuration + completedEvent.incompleteTestSeconds - afk;
  await UserDAL.updateTypingStats(
    uid,
    completedEvent.restartCount,
    totalDurationTypedSeconds,
    completedEvent.client,
  );
  await PublicDAL.updateStats(
    completedEvent.restartCount,
    totalDurationTypedSeconds,
    completedEvent.client,
  );

  const dailyLeaderboardsConfig = req.ctx.configuration.dailyLeaderboards;
  const dailyLeaderboard = getDailyLeaderboard(
    completedEvent.language,
    completedEvent.mode,
    completedEvent.mode2,
    dailyLeaderboardsConfig,
    -1,
    completedEvent.client,
  );

  let dailyLeaderboardRank = -1;

  const stopOnLetterTriggered =
    completedEvent.stopOnLetter && completedEvent.acc < 100;

  const minTimeTyping = (await getCachedConfiguration(true)).leaderboards
    .minTimeTyping;

  const userEligibleForLeaderboard =
    user.banned !== true &&
    user.lbOptOut !== true &&
    (isDevEnvironment() || (profile.timeTyping ?? 0) > minTimeTyping);

  const validResultCriteria =
    !offline &&
    canFunboxGetPb(completedEvent) &&
    !completedEvent.bailedOut &&
    userEligibleForLeaderboard &&
    !stopOnLetterTriggered;

  const selectedBadgeId = user.inventory?.badges?.find((b) => b.selected)?.id;
  const isPremium =
    (await UserDAL.checkIfUserIsPremium(user.uid, user)) || undefined;

  if (dailyLeaderboard && validResultCriteria) {
    dailyLeaderboardRank = await dailyLeaderboard.addResult(
      {
        name: user.name,
        wpm: completedEvent.wpm,
        raw: completedEvent.rawWpm,
        acc: completedEvent.acc,
        consistency: completedEvent.consistency,
        timestamp: completedEvent.timestamp,
        uid,
        badgeId: selectedBadgeId,
        isPremium,
      },
      dailyLeaderboardsConfig,
    );
    if (
      dailyLeaderboardRank >= 1 &&
      dailyLeaderboardRank <= 10 &&
      completedEvent.testDuration <= 120
    ) {
      const now = Date.now();
      const reset = getCurrentDayTimestamp();
      const limit = 6 * 60 * 60 * 1000;
      if (now - reset >= limit) {
        await addLog("daily_leaderboard_top_10_result", completedEvent, uid);
      }
    }
  }

  const streak = await UserDAL.updateStreak(
    uid,
    completedEvent.timestamp,
    completedEvent.client,
  );
  const badgeWaitingInInbox = (
    user.inbox?.flatMap((i) =>
      (i.rewards ?? []).map((r) => (r.type === "badge" ? r.item.id : null)),
    ) ?? []
  ).includes(14);

  const shouldGetBadge =
    !offline &&
    streak >= 365 &&
    user.inventory?.badges?.find((b) => b.id === 14) === undefined &&
    !badgeWaitingInInbox;

  if (shouldGetBadge) {
    const mail = buildMonkeyMail({
      subject: "Badge",
      body: "Congratulations for reaching a 365 day streak! You have been awarded a special badge. Now, go touch some grass.",
      rewards: [
        {
          type: "badge",
          item: {
            id: 14,
          },
        },
      ],
    });
    mail.id = "365streak";
    await UserDAL.addToInbox(
      uid,
      [{ ...mail, id: `365streak${objectHash(uid)}` }],
      req.ctx.configuration.users.inbox,
    );
  }

  const xpGained: XpResult = offline
    ? { xp: 0 }
    : await calculateXp(
        completedEvent,
        req.ctx.configuration.users.xp,
        lastResultTimestamp,
        profile.xp ?? 0,
        streak,
      );

  if (isNaN(xpGained.xp)) {
    throw new MonkeyError(
      500,
      "Calculated XP is NaN",
      JSON.stringify({
        xpGained,
        result: completedEvent,
      }),
      uid,
    );
  }

  if (xpGained.xp < 0) {
    throw new MonkeyError(
      500,
      "Calculated XP is negative",
      JSON.stringify({
        xpGained,
        result: completedEvent,
      }),
      uid,
    );
  }

  const weeklyXpLeaderboardConfig = req.ctx.configuration.leaderboards.weeklyXp;
  let weeklyXpLeaderboardRank = -1;

  const weeklyXpLeaderboard = WeeklyXpLeaderboard.get(
    weeklyXpLeaderboardConfig,
    undefined,
    completedEvent.client,
  );
  if (
    !offline &&
    userEligibleForLeaderboard &&
    xpGained.xp > 0 &&
    weeklyXpLeaderboard
  ) {
    weeklyXpLeaderboardRank = await weeklyXpLeaderboard.addResult(
      weeklyXpLeaderboardConfig,
      {
        entry: {
          uid,
          name: user.name,
          badgeId: selectedBadgeId,
          lastActivityTimestamp: Date.now(),
          isPremium,
          timeTypedSeconds: totalDurationTypedSeconds,
        },
        xpGained: xpGained.xp,
      },
    );
  }

  const dbresult = buildDbResult(completedEvent, user.name, isPb);
  (dbresult as typeof dbresult & { submissionHash: string }).submissionHash =
    submissionHash;
  if (keySpacingStats !== undefined) {
    dbresult.keySpacingStats = keySpacingStats;
  }
  if (keyDurationStats !== undefined) {
    dbresult.keyDurationStats = keyDurationStats;
  }

  const addedResult = await ResultDAL.addResult(uid, dbresult);
  await reviewKeyTiming(
    completedEvent,
    {
      resultId: addedResult.insertedId,
      submissionHash: resulthash,
      verified: user.verified === true,
      lbOptOut: user.lbOptOut === true,
      suspicious: user.suspicious === true,
    },
    req.ctx.configuration.anticheat,
  );

  await UserDAL.incrementXp(uid, xpGained.xp, completedEvent.client);
  await UserDAL.incrementTestActivity(
    user,
    completedEvent.timestamp,
    completedEvent.client,
  );

  if (isPb) {
    await addLog(
      "user_new_pb",
      `${`${completedEvent.mode} ${completedEvent.mode2}`} ${
        completedEvent.wpm
      } ${completedEvent.acc}% ${completedEvent.rawWpm} ${
        completedEvent.consistency
      }% (${addedResult.insertedId})`,
      uid,
    );
  }

  const data: PostResultResponse = {
    isPb,
    tagPbs,
    insertedId: addedResult.insertedId,
    xp: xpGained.xp,
    dailyXpBonus: xpGained.dailyBonus ?? false,
    xpBreakdown: xpGained.breakdown ?? {},
    streak,
  };

  if (dailyLeaderboardRank !== -1) {
    data.dailyLeaderboardRank = dailyLeaderboardRank;
  }

  if (weeklyXpLeaderboardRank !== -1) {
    data.weeklyXpLeaderboardRank = weeklyXpLeaderboardRank;
  }

  return new MonkeyResponse("Result saved", data);
}

type XpResult = {
  xp: number;
  dailyBonus?: boolean;
  breakdown?: XpBreakdown;
};

/**
 * Log-only review of a saved result. Signals are uncalibrated, so they are
 * written for review and calibration and never reject, strike or ban.
 */
async function reviewKeyTiming(
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

async function calculateXp(
  result: CompletedEvent,
  xpConfiguration: Configuration["users"]["xp"],
  lastResultTimestamp: number | null,
  currentTotalXp: number,
  streak: number,
): Promise<XpResult> {
  const {
    mode,
    acc,
    testDuration,
    incompleteTestSeconds,
    incompleteTests,
    afkDuration,
    charStats,
    punctuation,
    numbers,
    funbox: resultFunboxes,
  } = result;

  const {
    enabled,
    gainMultiplier,
    maxDailyBonus,
    minDailyBonus,
    funboxBonus: funboxBonusConfiguration,
  } = xpConfiguration;

  if (mode === "zen" || !enabled) {
    return {
      xp: 0,
    };
  }

  const breakdown: XpBreakdown = {};

  const baseXp = Math.round((testDuration - afkDuration) * 2);
  breakdown.base = baseXp;

  let modifier = 1;

  const correctedEverything = charStats
    .slice(1)
    .every((charStat: number) => charStat === 0);

  if (acc === 100) {
    modifier += 0.5;
    breakdown.fullAccuracy = Math.round(baseXp * 0.5);
  } else if (correctedEverything) {
    // corrected everything bonus
    modifier += 0.25;
    breakdown.corrected = Math.round(baseXp * 0.25);
  }

  if (mode === "quote") {
    // real sentences bonus
    modifier += 0.5;
    breakdown.quote = Math.round(baseXp * 0.5);
  } else {
    // punctuation bonus
    if (punctuation) {
      modifier += 0.4;
      breakdown.punctuation = Math.round(baseXp * 0.4);
    }
    if (numbers) {
      modifier += 0.1;
      breakdown.numbers = Math.round(baseXp * 0.1);
    }
  }

  if (funboxBonusConfiguration > 0 && resultFunboxes.length !== 0) {
    const funboxModifier = resultFunboxes.reduce((sum, funboxName) => {
      const funbox = getFunbox(funboxName);
      const difficultyLevel = funbox?.difficultyLevel ?? 0;
      return sum + Math.max(difficultyLevel * funboxBonusConfiguration, 0);
    }, 0);

    if (funboxModifier > 0) {
      modifier += funboxModifier;
      breakdown.funbox = Math.round(baseXp * funboxModifier);
    }
  }

  if (xpConfiguration.streak.enabled) {
    const streakModifier = parseFloat(
      mapRange(
        streak,
        0,
        xpConfiguration.streak.maxStreakDays,
        0,
        xpConfiguration.streak.maxStreakMultiplier,
        true,
      ).toFixed(1),
    );

    if (streakModifier > 0) {
      modifier += streakModifier;
      breakdown.streak = Math.round(baseXp * streakModifier);
    }
  }

  let incompleteXp = 0;
  if (incompleteTests !== undefined && incompleteTests.length > 0) {
    incompleteTests.forEach((it: { acc: number; seconds: number }) => {
      let mod = (it.acc - 50) / 50;
      if (mod < 0) mod = 0;
      incompleteXp += Math.round(it.seconds * mod);
    });
    breakdown.incomplete = incompleteXp;
  } else if (incompleteTestSeconds && incompleteTestSeconds > 0) {
    incompleteXp = Math.round(incompleteTestSeconds);
    breakdown.incomplete = incompleteXp;
  }

  const accuracyModifier = (acc - 50) / 50;

  let dailyBonus = 0;
  if (isSafeNumber(lastResultTimestamp)) {
    const lastResultDay = getStartOfDayTimestamp(lastResultTimestamp);
    const today = getCurrentDayTimestamp();
    if (lastResultDay !== today) {
      const proportionalXp = Math.round(currentTotalXp * 0.05);
      dailyBonus = Math.max(
        Math.min(maxDailyBonus, proportionalXp),
        minDailyBonus,
      );
      breakdown.daily = dailyBonus;
    }
  }

  const xpWithModifiers = Math.round(baseXp * modifier);

  const xpAfterAccuracy = Math.round(xpWithModifiers * accuracyModifier);
  breakdown.accPenalty = xpWithModifiers - xpAfterAccuracy;

  const totalXp =
    Math.round((xpAfterAccuracy + incompleteXp) * gainMultiplier) + dailyBonus;

  if (gainMultiplier !== 1) {
    // breakdown.push([
    //   "configMultiplier",
    //   Math.round((xpAfterAccuracy + incompleteXp) * (gainMultiplier - 1)),
    // ]);
    breakdown.configMultiplier = gainMultiplier;
  }

  const isAwardingDailyBonus = dailyBonus > 0;

  return {
    xp: totalXp,
    dailyBonus: isAwardingDailyBonus,
    breakdown,
  };
}
