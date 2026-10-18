import * as ResultDAL from "../../../dal/result";
import * as PublicDAL from "../../../dal/public";
import { isDevEnvironment } from "../../../utils/misc";
import objectHash from "object-hash";

import { MonkeyResponse } from "../../../utils/monkey-response";
import MonkeyError from "../../../utils/error";

import { getDailyLeaderboard } from "../../../utils/daily-leaderboards";
import * as UserDAL from "../../../dal/user";
import { buildMonkeyMail } from "../../../utils/monkey-mail";
import * as WeeklyXpLeaderboard from "../../../services/weekly-xp-leaderboard";
import { canFunboxGetPb } from "../../../utils/pb";
import { buildDbResult } from "../../../utils/result";

import { addLog } from "../../../dal/logs";
import { AddResultResponse } from "@oxytype/contracts/results";
import { PostResultResponse } from "@oxytype/schemas/results";

import { getCurrentDayTimestamp } from "@oxytype/util/date-and-time";

import { getCachedConfiguration } from "../../../init/configuration";

import type { ValidatedSubmission } from "./context";
import { calculateXp, type XpResult } from "./xp";
import { reviewKeyTiming } from "./timing-review";
export async function applyProgression(
  submission: ValidatedSubmission,
): Promise<AddResultResponse> {
  const {
    context,
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
  } = submission;
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

  const dailyLeaderboardsConfig = context.configuration.dailyLeaderboards;
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
      context.configuration.users.inbox,
    );
  }

  const xpGained: XpResult = offline
    ? { xp: 0 }
    : await calculateXp(
        completedEvent,
        context.configuration.users.xp,
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

  const weeklyXpLeaderboardConfig = context.configuration.leaderboards.weeklyXp;
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
    context.configuration.anticheat,
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
